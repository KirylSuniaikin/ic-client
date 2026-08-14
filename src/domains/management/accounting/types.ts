export type AccountingType = 'CREDIT' | 'DEBIT';

export interface AccountingCategoryTO {
    id: number;
    name: string;
    type: AccountingType;
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
    /** Whether a receipt photo is stored for this entry. */
    hasImage: boolean;
    /**
     * Echo of the clientRef sent on create/update — how a photo picked for a row that had no id
     * yet finds the id the save just assigned. Always null when reading a report.
     */
    clientRef?: string | null;
}

/** Metadata returned by the entry-photo upload endpoint. The bytes are never inlined in JSON. */
export interface EntryImageMetaTO {
    entryId: number;
    contentType: string;
    sizeBytes: number;
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
    /** Opaque row key echoed back on the saved entry, so a pending photo can find its new id. */
    clientRef?: string;
}

export interface UpdateEntryPayload {
    /** Omitted for a row added in this edit; sending it keeps the entry — and its photo — alive. */
    id?: number;
    categoryId: number;
    amount: number;
    accountType: string;
    occurredAt: string;
    note?: string;
    clientRef?: string;
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
