export type BaseShiftResponse = {
    id: number;
    title: string;
    branchNo: number;
    cookTotalHours: number;
    managerTotalHours: number;
}

export type CreateShiftReportTO = {
    title: string;
    totalHours: number;
    branchNo: number;
    shifts: ShiftInfoTO[]
}

export type ShiftInfoTO = {
    shiftDate: string;
    cookStartTime: string;
    cookEndTime: string;
    cookTotal: number;
    managerStartTime: string;
    managerEndTime: string;
    managerTotal: number;
};

export type EditShiftReportTO = {
    id: number;
    title: string;
    totalHours: number;
    branchNo: number;
    shifts: ShiftInfoTO[]
}

export type ShiftReportTO = {
    id: number;
    title: string;
    cookTotalHours: number;
    managerTotalHours: number;
    branchNo: number;
    shifts: ShiftInfoTO[]
}

export type ShiftRow = {
    id: string;
    shiftDate: string;
    cookStartTime: string | null;
    cookEndTime: string | null;
    cookTotalHours: number | null;
    managerStartTime: string | null;
    managerEndTime: string | null;
    managerTotalHours: number | null;
}