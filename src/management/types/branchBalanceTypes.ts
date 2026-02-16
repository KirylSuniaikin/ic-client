export type BranchBalanceResponse = {
    branchBalance: number
}

export type CashUpdateRequest = {
    branchId: string,
    cashUpdateType: CashUpdateType,
    amount: number,
    note: string,
}

export enum CashUpdateType{
    CASH_IN= 'CASH_IN',
    CASH_OUT = 'CASH_OUT'
}

export interface CashRegisterEventTO {
    id: string;
    notes: string;
    branchId: string;
    amount: number;
    type: CashUpdateType;
    date: string;
}