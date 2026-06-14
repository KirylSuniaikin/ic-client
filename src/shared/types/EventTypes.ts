export type ShiftEventResponse = {
    shiftNo: number;
    cashWarning: CashWarning;
}

export type CashWarning = {
    error: string
    expected: number
}
