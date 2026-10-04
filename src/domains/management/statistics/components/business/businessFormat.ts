import type { ChannelField, ExpenseBlock, KpiTag, PnlClass } from "../../types";
import { normalizeDecimal } from "../../../../../shared/utils/decimalUtils";
import { PreResponseNetworkError } from "../../../../../shared/api/client";

/**
 * Why a save failed, as the tail of a "Couldn't save …" line. The API layer already words HTTP
 * failures for people; a dropped connection would otherwise read as the browser's "Failed to fetch".
 */
export function describeSaveError(error: unknown): string {
    if (error instanceof PreResponseNetworkError) return "no connection to the server — check the internet and try again";
    return error instanceof Error ? error.message : "unknown error";
}

/** "2026-09" → "Sep 26": the channel table's month pills, and how a save error names the month. */
export function shortMonthLabel(period: string): string {
    const [year, month] = period.split("-");
    return new Date(Number(year), Number(month) - 1, 1)
        .toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

/** How an editable channel cell is named in an error, so the owner knows which figure was refused. */
export const CHANNEL_FIELD_LABELS: Record<ChannelField, string> = {
    orders: "orders",
    grossRevenue: "gross revenue",
    appFees: "app fees",
};

/**
 * BHD is denominated in fils, so money is always three decimal places here — the same convention
 * the accounting screens use. Never Intl's default two.
 */
export function formatBd(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) return "—";
    return value.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

/**
 * Ledger income (categories classed REVENUE) has its own card. One home for the rule, so the income
 * card, the expense pivot and the pivot's block count cannot disagree about what counts as income.
 */
export function isLedgerIncomeBlock(block: ExpenseBlock): boolean {
    return block.pnlClass === "REVENUE";
}

/**
 * The expense pivot is read as a table of costs, so it signs a credit negative. Income reads the
 * other way round: a payout shows positive, a reversal against it negative. `0 - amount` rather
 * than `-amount`, because negating an empty month gives -0, which formats as "-0.000".
 */
export function asIncome(amount: number): number {
    return 0 - amount;
}

export type ParsedCellInput =
    | { kind: "value"; value: number | null }
    | { kind: "invalid"; reason: string };

/**
 * Reads what was typed into an editable figure; empty means "no figure". A comma is the decimal
 * point, as on every other admin screen (normalizeDecimal/toDecimal), so "12,5" is 12.5. Anything
 * normalizeDecimal would have to strip — "1,800.5", "12a", "1e3" — is refused rather than guessed
 * at: for money the two readings of a comma differ by a factor of a thousand.
 */
export function parseCellInput(raw: string, wholeNumber: boolean): ParsedCellInput {
    const trimmed = raw.trim();
    if (trimmed === "") return { kind: "value", value: null };

    const candidate = trimmed.replace(",", ".");
    const value = Number(candidate);
    if (normalizeDecimal(trimmed) !== candidate || !Number.isFinite(value)) {
        return { kind: "invalid", reason: "is not a number" };
    }
    if (value < 0) return { kind: "invalid", reason: "cannot be negative" };
    if (wholeNumber && !Number.isInteger(value)) return { kind: "invalid", reason: "must be a whole number" };
    // A fils is the smallest BHD amount, and the server refuses a fourth decimal: refused here, the
    // owner hears it at once instead of after a round trip and a rollback.
    // Trailing zeros are not precision: "12.5000" is fine.
    if (/\.\d{4,}$/.test(candidate.replace(/0+$/, ""))) {
        return { kind: "invalid", reason: "can have at most 3 decimal places" };
    }
    return { kind: "value", value };
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
