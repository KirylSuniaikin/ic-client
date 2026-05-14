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
    cookStaffIds: number[];
    managerStaffIds: number[];
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
    cookStaffIds: number[];
    managerStaffIds: number[];
}

export type StaffOption = {
    id: number;
    username: string;
    role: string;
};

export type StaffShiftSummary = {
    staffId: number;
    username: string;
    role: string;
    pricePerHour: number | null;
    regularHours: number;
    overtimeHours: number;
    totalHours: number;
    regularCost: number | null;
    overtimeCost: number | null;
    totalCost: number | null;
};

export type MonthlyShiftReport = {
    yearMonth: string;
    branchNo: number;
    summaries: StaffShiftSummary[];
};
