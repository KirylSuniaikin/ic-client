import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react";
import { getDoughInventory, putDoughAvailability } from "../../../../shared/api/management";
import { logger } from "../../../../shared/utils/logger";
import type { DoughStatus } from "../types";
import { useDough } from "./useDough";

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/management.ts
jest.mock("../../../../shared/api/management");

const mockGetDoughInventory = jest.mocked(getDoughInventory);
const mockPutDoughAvailability = jest.mocked(putDoughAvailability);

function status(overrides: Partial<DoughStatus> = {}): DoughStatus {
    return {
        S: 10,
        M: 10,
        L: 10,
        Brick: 10,
        availability: { S: false, M: true, L: true, "Brick dough": true },
        ...overrides,
    };
}

// Drives the hook the way AdminHomePage does: it owns the doughStatus state and passes the
// setter in, so the test has to hold that state itself to observe what the hook writes.
function renderDough(initial: DoughStatus | null) {
    let current: DoughStatus | null = initial;
    const setDoughStatus = jest.fn((update: unknown) => {
        current = typeof update === "function"
            ? (update as (prev: DoughStatus | null) => DoughStatus | null)(current)
            : (update as DoughStatus | null);
    });
    const view = renderHook(
        ({ s }: { s: DoughStatus | null }) => useDough("branch-1", s, setDoughStatus as never),
        { initialProps: { s: initial } }
    );
    return { view, setDoughStatus, read: (): DoughStatus | null => current };
}

describe("useDough availability toggle", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetDoughInventory.mockResolvedValue(status());
    });

    it("applies the server's answer, not the optimistic guess", async () => {
        const applied = status({ availability: { S: true, M: true, L: true, "Brick dough": true } });
        mockPutDoughAvailability.mockResolvedValue(applied);
        const { view, read } = renderDough(status());

        await act(async () => { await view.result.current.onDoughAvailabilityToggle("S"); });

        expect(mockPutDoughAvailability).toHaveBeenCalledWith("branch-1", {
            S: true, M: true, L: true, "Brick dough": true,
        });
        expect(read()?.availability.S).toBe(true);
    });

    // The bug that looked like the widget "bouncing back on its own": the endpoint re-reads
    // availability from the branch's menu items rather than echoing the request, so a branch with
    // no items of that size answers "still unavailable" — successfully, and until now silently.
    it("warns when the server's answer contradicts the requested toggle", async () => {
        const unchanged = status();
        mockPutDoughAvailability.mockResolvedValue(unchanged);
        const warn = jest.spyOn(logger, "warn").mockImplementation(() => undefined);
        const { view, read } = renderDough(status());

        await act(async () => { await view.result.current.onDoughAvailabilityToggle("S"); });

        expect(read()?.availability.S).toBe(false);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(String(warn.mock.calls[0][0])).toContain("no menu items");
        warn.mockRestore();
    });

    it("stays quiet when the server agrees", async () => {
        mockPutDoughAvailability.mockResolvedValue(
            status({ availability: { S: true, M: true, L: true, "Brick dough": true } })
        );
        const warn = jest.spyOn(logger, "warn").mockImplementation(() => undefined);
        const { view } = renderDough(status());

        await act(async () => { await view.result.current.onDoughAvailabilityToggle("S"); });

        expect(warn).not.toHaveBeenCalled();
        warn.mockRestore();
    });

    it("rolls back to the previous flags when the request fails", async () => {
        mockPutDoughAvailability.mockRejectedValue(new Error("HTTP 500"));
        const error = jest.spyOn(logger, "error").mockImplementation(() => undefined);
        const before = status();
        const { view, read } = renderDough(before);

        await act(async () => { await view.result.current.onDoughAvailabilityToggle("S"); });

        await waitFor(() => expect(read()?.availability.S).toBe(false));
        expect(error).toHaveBeenCalled();
        error.mockRestore();
    });

    it("does nothing without a loaded status", async () => {
        const { view } = renderDough(null);

        await act(async () => { await view.result.current.onDoughAvailabilityToggle("S"); });

        expect(mockPutDoughAvailability).not.toHaveBeenCalled();
    });
});
