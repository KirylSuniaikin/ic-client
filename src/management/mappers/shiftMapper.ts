import {ShiftInfoTO, ShiftRow} from "../types/shiftTypes";

export function toShiftInfoTO(rawRow: ShiftRow): ShiftInfoTO {
    return {
        shiftDate: rawRow.shiftDate,
        endTime: rawRow.endTime,
        startTime: rawRow.startTime,
        total: rawRow.totalHours
    }
}