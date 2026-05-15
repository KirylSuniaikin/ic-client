export type AccountingType = 'CREDIT' | 'DEBIT';

export interface AccountingCategoryTO {
    id: number;
    name: string;
    type: AccountingType;
    archived: boolean;
}

export interface AccountingEntryTO {
    id: number;
    categoryId: number;
    categoryName: string;
    type: AccountingType;
    amount: number;
    accountType: string;
    occurredAt: string;
    note: string | null;
    contributorName: string;
    runningBalance?: number;
}

export interface AccountingReportSummary {
    id: number;
    title: string;
    createdAt: string;
    version: number;
    totalIncome: number;
    totalExpense: number;
}

export interface AccountingReportTO {
    id: number;
    title: string;
    createdAt: string;
    version: number;
    entries: AccountingEntryTO[];
}

export interface CreateEntryPayload {
    categoryId: number;
    amount: number;
    occurredAt: string;
    accountType: string;
    note?: string;
}

export interface UpdateEntryPayload {
    id?: number;
    categoryId: number;
    amount: number;
    accountType: string;
    occurredAt: string;
    note?: string;
}

export interface CreateAccountingReportPayload {
    branchId: string;
    title: string;
    entries: CreateEntryPayload[];
}

export interface UpdateAccountingReportPayload {
    version: number;
    entries: UpdateEntryPayload[];
}

export type AccountingPopupState =
    | { open: false }
    | { open: true; mode: 'new' }
    | { open: true; mode: 'edit'; reportId: number };
