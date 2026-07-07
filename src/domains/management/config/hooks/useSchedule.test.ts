import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { renderHook, waitFor, act } from "@testing-library/react";
import { getWorkingHours, putWorkingHours } from "../../../../shared/api/management";
import type { WorkingHoursSchedule, WorkingHoursResponse } from "../../../../shared/api/management";
import { useSchedule } from "./useSchedule";

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/management.ts
jest.mock("../../../../shared/api/management");

const mockGetWorkingHours = jest.mocked(getWorkingHours);
const mockPutWorkingHours = jest.mocked(putWorkingHours);

const MOCK_SCHEDULE: WorkingHoursSchedule = {
    Sunday: { isOpen: false, shifts: [] },
    Monday: { isOpen: true, shifts: [["15:00", "24:00"]] },
    Tuesday: { isOpen: true, shifts: [["15:00", "24:00"]] },
    Wednesday: { isOpen: false, shifts: [] },
    Thursday: { isOpen: false, shifts: [] },
    Friday: { isOpen: false, shifts: [] },
    Saturday: { isOpen: false, shifts: [] },
};

const MOCK_RESPONSE: WorkingHoursResponse = {
    branchId: "branch-1",
    schedule: MOCK_SCHEDULE,
    updatedAt: "2026-06-30T10:00:00Z",
};

describe("useSchedule", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("starts with null schedule and loading true", () => {
        // Never-resolving promise keeps loading=true during the check.
        mockGetWorkingHours.mockImplementation(() => new Promise(() => {}));

        const { result } = renderHook(() => useSchedule("branch-1"));

        expect(result.current.schedule).toBeNull();
        expect(result.current.loading).toBe(true);
    });

    it("sets schedule from getWorkingHours response when fetch resolves", async () => {
        mockGetWorkingHours.mockResolvedValue(MOCK_RESPONSE);

        const { result } = renderHook(() => useSchedule("branch-1"));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.schedule).toEqual(MOCK_SCHEDULE);
        expect(result.current.localSchedule).toEqual(MOCK_SCHEDULE);
    });

    it("returns null when getWorkingHours resolves with null (204)", async () => {
        mockGetWorkingHours.mockResolvedValue(null);

        const { result } = renderHook(() => useSchedule("branch-1"));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.schedule).toBeNull();
        expect(result.current.localSchedule).toBeNull();
    });

    it("sets error when getWorkingHours rejects", async () => {
        mockGetWorkingHours.mockRejectedValue(new Error("HTTP 500"));

        const { result } = renderHook(() => useSchedule("branch-1"));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.error).toBe("HTTP 500");
        expect(result.current.schedule).toBeNull();
    });

    it("calls putWorkingHours with correct payload when save is called", async () => {
        mockGetWorkingHours.mockResolvedValue(MOCK_RESPONSE);
        mockPutWorkingHours.mockResolvedValue(MOCK_RESPONSE);

        const { result } = renderHook(() => useSchedule("branch-1"));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        const updatedSchedule: WorkingHoursSchedule = {
            ...MOCK_SCHEDULE,
            Wednesday: { isOpen: true, shifts: [["16:00", "22:00"]] },
        };

        act(() => {
            result.current.setLocalSchedule(updatedSchedule);
        });

        await act(async () => {
            await result.current.save();
        });

        expect(mockPutWorkingHours).toHaveBeenCalledWith({
            branchId: "branch-1",
            schedule: updatedSchedule,
        });
    });

    it("updates schedule state and clears dirty flag after successful save", async () => {
        mockGetWorkingHours.mockResolvedValue(MOCK_RESPONSE);
        mockPutWorkingHours.mockResolvedValue(MOCK_RESPONSE);

        const { result } = renderHook(() => useSchedule("branch-1"));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        const updatedSchedule: WorkingHoursSchedule = {
            ...MOCK_SCHEDULE,
            Wednesday: { isOpen: true, shifts: [["16:00", "22:00"]] },
        };

        act(() => {
            result.current.setLocalSchedule(updatedSchedule);
        });

        expect(result.current.dirty).toBe(true);

        await act(async () => {
            await result.current.save();
        });

        expect(result.current.dirty).toBe(false);
        expect(result.current.schedule).toBe(result.current.localSchedule);
    });

    it("sets error state when putWorkingHours rejects", async () => {
        mockGetWorkingHours.mockResolvedValue(MOCK_RESPONSE);
        mockPutWorkingHours.mockRejectedValue(new Error("HTTP 403"));

        const { result } = renderHook(() => useSchedule("branch-1"));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        act(() => {
            result.current.setLocalSchedule({
                ...MOCK_SCHEDULE,
                Wednesday: { isOpen: true, shifts: [["16:00", "22:00"]] },
            });
        });

        await act(async () => {
            await result.current.save();
        });

        expect(result.current.error).toBe("HTTP 403");
        // dirty should remain true — schedule was not updated.
        expect(result.current.dirty).toBe(true);
    });

    it("reverts localSchedule to schedule when reset is called", async () => {
        mockGetWorkingHours.mockResolvedValue(MOCK_RESPONSE);

        const { result } = renderHook(() => useSchedule("branch-1"));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        act(() => {
            result.current.setLocalSchedule({
                ...MOCK_SCHEDULE,
                Wednesday: { isOpen: true, shifts: [["16:00", "22:00"]] },
            });
        });

        expect(result.current.dirty).toBe(true);

        act(() => {
            result.current.reset();
        });

        expect(result.current.dirty).toBe(false);
        expect(result.current.localSchedule).toEqual(MOCK_SCHEDULE);
    });
});
