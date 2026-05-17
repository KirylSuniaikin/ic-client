import type { ShiftRow, ShiftEntryPayload } from "../types/shiftTypes";

export function toShiftEntryPayload(row: ShiftRow): ShiftEntryPayload {
    if (row.staffId === null) {
        throw new Error("Row " + row.id + " has no contributor assigned");
    }
    return {
        shiftDate: row.shiftDate,
        startTime: row.startTime,
        endTime: row.endTime,
        totalHours: row.totalHours,
        staffId: row.staffId,
    };
}
