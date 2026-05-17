// GET /api/get_shift_reports list item
export type BaseShiftResponse = {
    id: number;
    title: string;
    branchNo: number;
    totalHours: number;
};

// Inbound: one shift entry from GET /api/get_shift_report
export type ShiftEntryTO = {
    id: number;
    shiftDate: string;               // "YYYY-MM-DD"
    startTime: string | null;        // "HH:mm" or null
    endTime: string | null;
    totalHours: number | null;
    staffId: number;
    staffUsername: string;
};

// Outbound: one row in POST create and PUT edit
export type ShiftEntryPayload = {
    shiftDate: string;               // "YYYY-MM-DD"
    startTime: string | null;
    endTime: string | null;
    totalHours: number | null;
    staffId: number;                 // non-nullable; validate before mapping
};

// UI-only DataGrid row
export type ShiftRow = {
    id: string;                      // client-only DataGrid key
    shiftDate: string;               // "YYYY-MM-DD"
    startTime: string | null;
    endTime: string | null;
    totalHours: number | null;       // computed; never edited directly
    staffId: number | null;          // null until contributor is selected
};

// POST /api/create_shift_report body
export type CreateShiftReportTO = {
    title: string;
    totalHours: number;
    branchNo: number;
    shifts: ShiftEntryPayload[];
};

// PUT /api/edit_shift_report body
export type EditShiftReportTO = {
    id: number;
    title: string;
    totalHours: number;
    creationTimeStamp: string;       // "YYYY-MM-DD" --- required by backend contract
    branchNo: number;
    shifts: ShiftEntryPayload[];
};

// GET /api/get_shift_report response
export type ShiftReportTO = {
    id: number;
    title: string;
    totalHours: number;
    creationTimeStamp: string;       // "YYYY-MM-DD"
    branchNo: number;
    shifts: ShiftEntryTO[];
};

// Unchanged --- keep exactly as-is
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
