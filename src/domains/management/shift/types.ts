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
    fullName: string | null;
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

// ── Salary slip ──────────────────────────────────────────────────────────────
// The slip is confirmed in a popup before it downloads: GET .../salary_slip/preview returns these
// defaults, the owner checks and may correct any of them, and POST .../salary_slip renders exactly
// what was confirmed. Edits are PRINT-ONLY -- nothing is written back to the employee's record.

export type SalarySlipDeduction = {
    description: string;
    amount: number | null;
};

export type SalarySlipForm = {
    employeeName: string;
    position: string;
    cprNumber: string | null;
    payPeriodLabel: string;
    paymentDate: string;              // "YYYY-MM-DD"
    basicSalary: number | null;
    housingAllowance: number | null;
    transportAllowance: number | null;
    // Printed in the overtime row's label, e.g. "Overtime (20.96 hrs @ 1.000/hr)".
    overtimeHours: number | null;
    overtimeRate: number | null;
    overtimeAmount: number | null;
    deductions: SalarySlipDeduction[];
    // Totals travel with the form rather than being recomputed server-side: the owner may
    // override them. The popup recalculates them live and flags any mismatch against the rows, so
    // an override is always deliberate.
    grossEarnings: number | null;
    totalDeductions: number | null;
    netPay: number | null;
    amountInWords: string;
    notes: string[];
};
