import type { KpiTag, PnlClass } from "../../types";

/**
 * BHD is denominated in fils, so money is always three decimal places here — the same convention
 * the accounting screens use. Never Intl's default two.
 */
export function formatBd(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) return "—";
    return value.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

/** Human labels for the P&L classes. Kept here so the drawer and the pivot cannot drift apart. */
export const PNL_CLASS_LABELS: Record<PnlClass, string> = {
    REVENUE: "Revenue (ledger)",
    COGS_PURCHASES: "COGS — groceries & packaging",
    OPEX: "Operating expense",
    CAPEX: "Capital expenditure",
    OWNER_WITHDRAWAL: "Owner withdrawal",
    FINANCING: "Financing & interest",
    ADJUSTMENT: "Adjustment",
    EXCLUDED: "Excluded from all totals",
};

/**
 * One line of guidance per class, shown under the picker. The two that are routinely got wrong are
 * COGS_PURCHASES (which is NOT an operating expense here) and EXCLUDED (which is a decision, not a
 * dustbin), so those carry the longest notes.
 */
export const PNL_CLASS_HINTS: Record<PnlClass, string> = {
    REVENUE: "Sales recorded in the ledger. Shown for reconciliation only — the P&L takes revenue from orders, not from here.",
    COGS_PURCHASES: "Groceries and packaging. Counted through COGS via inventory, deliberately NOT in Operating Expenses.",
    OPEX: "Rent, utilities, labour, marketing, subscriptions, supplies, legal. The Operating Expenses total.",
    CAPEX: "Equipment, fit-out, deposits. Expensed in the month of purchase — there is no depreciation.",
    OWNER_WITHDRAWAL: "Money taken out by the owners. Its own P&L line, counted exactly once.",
    FINANCING: "Loan repayments and interest.",
    ADJUSTMENT: "Refunds, corrections, support grants.",
    EXCLUDED: "Transfers and noise that are not trading activity. Still visible in the pivot, but in no total.",
};

export const KPI_TAG_LABELS: Record<KpiTag, string> = {
    MARKETING: "Marketing (drives MER)",
    LABOUR: "Labour (drives Labour %)",
    RENT: "Rent",
    UTILITIES: "Utilities",
};

export const PNL_CLASSES = Object.keys(PNL_CLASS_LABELS) as PnlClass[];
export const KPI_TAGS = Object.keys(KPI_TAG_LABELS) as KpiTag[];
