import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { renderHook, act, waitFor } from "@testing-library/react";
import { issueViolation, previewViolation, uploadViolationPhoto } from "../../../../shared/api/management";
import { useIssueViolation } from "./useIssueViolation";
import type { IssueResult } from "./useIssueViolation";
import { makeViolation } from "../testFixtures";
import type { IssuePreviewTO, ViolationTO } from "../types";

jest.mock("../../../../shared/api/management");
jest.mock("../../../../shared/utils/timeUtils", () => ({ todayIsoBahrain: () => "2026-10-08" }));

const mockPreview = jest.mocked(previewViolation);
const mockIssue = jest.mocked(issueViolation);
const mockUpload = jest.mocked(uploadViolationPhoto);

function makePreview(overrides: Partial<IssuePreviewTO> = {}): IssuePreviewTO {
    return {
        violationTypeId: 3, code: "4.2", title: "Late", violationClass: "B", points: 5, penaltyHours: 1,
        scoreBefore: 90, scoreAfter: 85, zoneBefore: "GREEN", zoneAfter: "GREEN", formalAction: null,
        outcomeStatus: "ACTIVE", expiresAt: null, shadowPilot: false,
        payCycle: { start: "2026-09-25", end: "2026-10-24" }, penaltyHoursInCycle: 0,
        capHours: null, maxDeductibleHours: null,
        ...overrides,
    };
}

beforeEach(() => {
    mockPreview.mockReset();
    mockIssue.mockReset();
    mockUpload.mockReset();
    mockPreview.mockResolvedValue(makePreview());
});

async function readyHook(onIssued: (r: IssueResult) => void = jest.fn()) {
    const hook = renderHook(() => useIssueViolation(7, onIssued));
    act(() => hook.result.current.setTypeId(3));
    act(() => hook.result.current.setComment("  Arrived late  "));
    await waitFor(() => expect(hook.result.current.preview).not.toBeNull());
    return hook;
}

describe("useIssueViolation", () => {
    it("defaults both dates to today", () => {
        const { result } = renderHook(() => useIssueViolation(7, jest.fn()));

        expect(result.current.discoveredOn).toBe("2026-10-08");
        expect(result.current.occurredOn).toBe("2026-10-08");
    });

    it("makes no preview call until a type, a non-blank comment and both dates exist", async () => {
        const { result } = renderHook(() => useIssueViolation(7, jest.fn()));

        act(() => result.current.setComment("   "));
        act(() => result.current.setTypeId(3));
        expect(mockPreview).not.toHaveBeenCalled();

        act(() => result.current.setComment("ok"));
        await waitFor(() => expect(mockPreview).toHaveBeenCalledTimes(1));
    });

    it("makes no preview call without a type even with a comment", () => {
        const { result } = renderHook(() => useIssueViolation(7, jest.fn()));

        act(() => result.current.setComment("ok"));

        expect(mockPreview).not.toHaveBeenCalled();
    });

    it("makes no preview call while a date is cleared", async () => {
        const { result } = await readyHook();
        mockPreview.mockClear();

        act(() => result.current.setOccurredOn(""));

        expect(mockPreview).not.toHaveBeenCalled();
        expect(result.current.preview).toBeNull();
    });

    it("sends the trimmed comment and does not re-run on further keystrokes", async () => {
        const { result } = await readyHook();
        expect(mockPreview).toHaveBeenCalledTimes(1);

        act(() => result.current.setComment("  Arrived late again  "));

        expect(mockPreview).toHaveBeenCalledTimes(1);
        expect(mockPreview).toHaveBeenLastCalledWith(7, {
            violationTypeId: 3, issuerComment: "Arrived late", occurredOn: "2026-10-08", discoveredOn: "2026-10-08",
        });
    });

    it("issues exactly one new preview call when the type changes", async () => {
        const { result } = await readyHook();
        mockPreview.mockClear();

        act(() => result.current.setTypeId(4));

        await waitFor(() => expect(mockPreview).toHaveBeenCalledTimes(1));
        expect(mockPreview.mock.calls[0][1].violationTypeId).toBe(4);
    });

    it("re-runs the preview when either date changes", async () => {
        const { result } = await readyHook();
        mockPreview.mockClear();

        act(() => result.current.setDiscoveredOn("2026-10-05"));
        await waitFor(() => expect(mockPreview).toHaveBeenCalledTimes(1));
        act(() => result.current.setOccurredOn("2026-10-04"));
        await waitFor(() => expect(mockPreview).toHaveBeenCalledTimes(2));
    });

    it("clears the preview and blocks submit when the comment becomes blank", async () => {
        const { result } = await readyHook();

        act(() => result.current.setComment(" "));

        expect(result.current.preview).toBeNull();
        expect(result.current.canSubmit).toBe(false);
    });

    it("drops a superseded preview response (latest wins)", async () => {
        let resolveFirst: (p: IssuePreviewTO) => void = () => {};
        mockPreview.mockReturnValueOnce(new Promise<IssuePreviewTO>((r) => { resolveFirst = r; }));
        mockPreview.mockResolvedValueOnce(makePreview({ title: "Second" }));
        const { result } = renderHook(() => useIssueViolation(7, jest.fn()));
        act(() => result.current.setComment("ok"));
        act(() => result.current.setTypeId(3));
        act(() => result.current.setTypeId(4));
        await waitFor(() => expect(result.current.preview?.title).toBe("Second"));

        await act(async () => { resolveFirst(makePreview({ title: "First" })); });

        expect(result.current.preview?.title).toBe("Second");
    });

    it("exposes the server message on a preview error and blocks submit", async () => {
        mockPreview.mockRejectedValue(new Error("Discovery too old"));
        const { result } = renderHook(() => useIssueViolation(7, jest.fn()));
        act(() => result.current.setTypeId(3));
        act(() => result.current.setComment("ok"));

        await waitFor(() => expect(result.current.previewError).toBe("Discovery too old"));
        expect(result.current.preview).toBeNull();
        expect(result.current.canSubmit).toBe(false);
    });

    it("submits the trimmed request, resets the form and reports no photo error", async () => {
        const violation = makeViolation({ id: 55 });
        mockIssue.mockResolvedValue(violation);
        const onIssued = jest.fn();
        const { result } = await readyHook(onIssued);

        await act(async () => { await result.current.submit(); });

        expect(mockIssue).toHaveBeenCalledWith(7, {
            violationTypeId: 3, issuerComment: "Arrived late", occurredOn: "2026-10-08", discoveredOn: "2026-10-08",
        });
        expect(mockUpload).not.toHaveBeenCalled();
        expect(onIssued).toHaveBeenCalledWith({ violation, photoError: null });
        expect(result.current.typeId).toBeNull();
        expect(result.current.comment).toBe("");
    });

    it("uploads the held photo against the new violation id", async () => {
        mockIssue.mockResolvedValue(makeViolation({ id: 55 }));
        mockUpload.mockResolvedValue({ violationId: 55, contentType: "image/jpeg", sizeBytes: 1 });
        const { result } = await readyHook();
        const blob = new Blob(["x"]);
        act(() => result.current.setPhoto(blob));

        await act(async () => { await result.current.submit(); });

        expect(mockUpload).toHaveBeenCalledWith(55, blob);
    });

    it("still resolves as a success with photoError set when the photo upload is rejected", async () => {
        const violation = makeViolation({ id: 55 });
        mockIssue.mockResolvedValue(violation);
        mockUpload.mockRejectedValue(new Error("Too large"));
        const onIssued = jest.fn();
        const { result } = await readyHook(onIssued);
        act(() => result.current.setPhoto(new Blob(["x"])));

        await act(async () => { await result.current.submit(); });

        expect(onIssued).toHaveBeenCalledWith({ violation, photoError: "Too large" });
        expect(result.current.submitError).toBeNull();
    });

    it("keeps the form and exposes the server message when issuing fails", async () => {
        mockIssue.mockRejectedValue(new Error("Cap reached"));
        const onIssued = jest.fn();
        const { result } = await readyHook(onIssued);

        await act(async () => { await result.current.submit(); });

        expect(result.current.submitError).toBe("Cap reached");
        expect(result.current.comment).toBe("  Arrived late  ");
        expect(result.current.typeId).toBe(3);
        expect(result.current.submitting).toBe(false);
        expect(onIssued).not.toHaveBeenCalled();
        expect(mockUpload).not.toHaveBeenCalled();
    });

    it("blocks a second submit while the first is in flight", async () => {
        let resolveIssue: (v: ViolationTO) => void = () => {};
        mockIssue.mockReturnValue(new Promise<ViolationTO>((r) => { resolveIssue = r; }));
        const { result } = await readyHook();

        act(() => { void result.current.submit(); });
        await waitFor(() => expect(result.current.submitting).toBe(true));
        expect(result.current.canSubmit).toBe(false);
        await act(async () => { await result.current.submit(); });

        expect(mockIssue).toHaveBeenCalledTimes(1);
        await act(async () => { resolveIssue(makeViolation()); });
    });

    it.each([[6], [0]])("can submit when the preview is over the cap (max deductible %s)", async (max) => {
        mockPreview.mockResolvedValue(makePreview({ capHours: max, maxDeductibleHours: max, penaltyHours: 5, penaltyHoursInCycle: 4 }));

        const { result } = await readyHook();

        expect(result.current.canSubmit).toBe(true);
    });
});
