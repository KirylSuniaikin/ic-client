import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { renderHook, act } from "@testing-library/react";
import { disputeViolation, submitExplanation } from "../../../../shared/api/management";
import { useMyViolationActions } from "./useMyViolationActions";
import { makeViolation } from "../testFixtures";
import type { ViolationTO } from "../types";

jest.mock("../../../../shared/api/management");

const mockExplain = jest.mocked(submitExplanation);
const mockDispute = jest.mocked(disputeViolation);

beforeEach(() => {
    mockExplain.mockReset();
    mockDispute.mockReset();
});

describe("useMyViolationActions", () => {
    it("explain calls the API with the text, then onDone, and resolves true", async () => {
        mockExplain.mockResolvedValue(makeViolation());
        const onDone = jest.fn();
        const { result } = renderHook(() => useMyViolationActions(onDone));

        let ok = false;
        await act(async () => {
            ok = await result.current.explain(4, "I was ill");
        });

        expect(ok).toBe(true);
        expect(mockExplain).toHaveBeenCalledWith(4, { text: "I was ill" });
        expect(onDone).toHaveBeenCalledTimes(1);
        expect(result.current.error).toBeNull();
        expect(result.current.busyIds.size).toBe(0);
    });

    it("dispute calls the API with the reason, then onDone, and resolves true", async () => {
        mockDispute.mockResolvedValue(makeViolation());
        const onDone = jest.fn();
        const { result } = renderHook(() => useMyViolationActions(onDone));

        let ok = false;
        await act(async () => {
            ok = await result.current.dispute(9, "Not me");
        });

        expect(ok).toBe(true);
        expect(mockDispute).toHaveBeenCalledWith(9, { reason: "Not me" });
        expect(onDone).toHaveBeenCalledTimes(1);
    });

    it("marks the id busy while in flight and clears it afterwards", async () => {
        let resolve: (v: ViolationTO) => void = () => undefined;
        mockExplain.mockReturnValue(new Promise<ViolationTO>((r) => { resolve = r; }));
        const { result } = renderHook(() => useMyViolationActions(jest.fn()));

        let pending: Promise<boolean> = Promise.resolve(false);
        act(() => {
            pending = result.current.explain(4, "x");
        });
        expect(result.current.busyIds.has(4)).toBe(true);

        await act(async () => {
            resolve(makeViolation());
            await pending;
        });
        expect(result.current.busyIds.has(4)).toBe(false);
    });

    it("exposes the server message on failure, resolves false, refreshes and does not throw", async () => {
        mockExplain.mockRejectedValue(new Error("Explanation window closed"));
        const onDone = jest.fn();
        const { result } = renderHook(() => useMyViolationActions(onDone));

        let ok = true;
        await act(async () => {
            ok = await result.current.explain(4, "late");
        });

        expect(ok).toBe(false);
        expect(result.current.error).toBe("Explanation window closed");
        expect(onDone).toHaveBeenCalledTimes(1);
        expect(result.current.busyIds.size).toBe(0);
    });

    it("exposes a dispute failure message and falls back to a generic one for non-Error rejections", async () => {
        mockDispute.mockRejectedValueOnce(new Error("Already disputed"));
        const { result } = renderHook(() => useMyViolationActions(jest.fn()));

        await act(async () => {
            await result.current.dispute(1, "r");
        });
        expect(result.current.error).toBe("Already disputed");

        mockDispute.mockRejectedValueOnce("boom");
        await act(async () => {
            await result.current.dispute(1, "r");
        });
        expect(result.current.error).toBe("Request failed");
    });

    it("clears a previous error when a new call starts", async () => {
        mockExplain.mockRejectedValueOnce(new Error("nope")).mockResolvedValueOnce(makeViolation());
        const { result } = renderHook(() => useMyViolationActions(jest.fn()));

        await act(async () => {
            await result.current.explain(1, "a");
        });
        expect(result.current.error).toBe("nope");

        await act(async () => {
            await result.current.explain(1, "a");
        });
        expect(result.current.error).toBeNull();
    });
});
