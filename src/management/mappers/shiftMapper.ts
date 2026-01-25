import {ShiftInfoTO, ShiftRow} from "../types/shiftTypes";

export function toShiftInfoTO(rawRow: ShiftRow): ShiftInfoTO {
    return {
        shiftDate: rawRow.shiftDate,
        cookEndTime: rawRow.cookEndTime,
        cookStartTime: rawRow.cookStartTime,
        cookTotal: rawRow.cookTotalHours,
        managerEndTime: rawRow.managerEndTime,
        managerStartTime: rawRow.managerStartTime,
        managerTotal: rawRow.managerTotalHours,
    }
}