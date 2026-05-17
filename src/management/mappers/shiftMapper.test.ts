import { describe, it, expect } from "@jest/globals";
import { toShiftEntryPayload } from "./shiftMapper";
import type { ShiftRow } from "../types/shiftTypes";

describe("toShiftEntryPayload", () => {
    it("maps all fields from a fully populated ShiftRow", () => {
        const row: ShiftRow = {
            id: "row-1",
            shiftDate: "2025-05-01",
            startTime: "08:00",
            endTime: "16:30",
            totalHours: 8.5,
            staffId: 3,
        };

        const result = toShiftEntryPayload(row);

        expect(result.shiftDate).toBe("2025-05-01");
        expect(result.startTime).toBe("08:00");
        expect(result.endTime).toBe("16:30");
        expect(result.totalHours).toBe(8.5);
        expect(result.staffId).toBe(3);
    });

    it("preserves null startTime", () => {
        const row: ShiftRow = {
            id: "row-2",
            shiftDate: "2025-05-01",
            startTime: null,
            endTime: "16:30",
            totalHours: null,
            staffId: 5,
        };

        const result = toShiftEntryPayload(row);

        expect(result.startTime).toBeNull();
    });

    it("preserves null endTime", () => {
        const row: ShiftRow = {
            id: "row-3",
            shiftDate: "2025-05-01",
            startTime: "08:00",
            endTime: null,
            totalHours: null,
            staffId: 5,
        };

        const result = toShiftEntryPayload(row);

        expect(result.endTime).toBeNull();
    });

    it("preserves null totalHours", () => {
        const row: ShiftRow = {
            id: "row-4",
            shiftDate: "2025-05-01",
            startTime: null,
            endTime: null,
            totalHours: null,
            staffId: 5,
        };

        const result = toShiftEntryPayload(row);

        expect(result.totalHours).toBeNull();
    });

    it("passes staffId through unchanged", () => {
        const row: ShiftRow = {
            id: "row-5",
            shiftDate: "2025-05-01",
            startTime: null,
            endTime: null,
            totalHours: null,
            staffId: 7,
        };

        const result = toShiftEntryPayload(row);

        expect(result.staffId).toBe(7);
    });

    it("does not include the id field in output", () => {
        const row: ShiftRow = {
            id: "row-6",
            shiftDate: "2025-05-01",
            startTime: null,
            endTime: null,
            totalHours: null,
            staffId: 1,
        };

        const result = toShiftEntryPayload(row);

        expect(result).not.toHaveProperty("id");
    });
});
