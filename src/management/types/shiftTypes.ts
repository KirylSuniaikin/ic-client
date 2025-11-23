export type BaseShiftResponse = {
    id: number;
    title: string;
    branchNo: number;
    totalHours: number;
}

export type CreateShiftReportTO = {
    title: string;
    totalHours: number;
    branchNo: number;
    shifts: ShiftInfoTO[]
}

export type ShiftInfoTO = {
    shiftDate: string;
    startTime: string;
    endTime: string;
    total: number;
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
    totalHours: number;
    branchNo: number;
    shifts: ShiftInfoTO[]
}

export type ShiftRow = {
    id: string;
    shiftDate: string;
    startTime: string | null;
    endTime: string | null;
    totalHours: number | null;
}