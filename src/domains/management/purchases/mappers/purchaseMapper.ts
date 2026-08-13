import { PurchaseInvoiceRow, PurchaseInvoiceRequest, PurchaseLineRow, PurchaseLineRequest, PurchaseSortKey, SortDir } from "../types";
import { toDecimal } from "../../../../shared/utils/decimalUtils";

export { toDecimal, p2, q3 } from "../../../../shared/utils/decimalUtils";

export const toPayloadLine = (r: PurchaseLineRow): PurchaseLineRequest => {
    if (r.productId == null) throw new Error(`Row ${r.id}: product is not selected`);
    const qty = Number(toDecimal(r.quantity).toFixed(3));
    const price = Number(toDecimal(r.price).toFixed(4));
    const finalPrice = Number(toDecimal(r.finalPrice).toFixed(3));
    if (Number.isNaN(qty) || Number.isNaN(price) || Number.isNaN(finalPrice)) {
        throw new Error(`Row ${r.id}: invalid quantity, price or total`);
    }
    return {
        id: r.productId,
        quantity: qty,
        price,
        finalPrice,
    };
};

export const toPayloadInvoice = (invoice: PurchaseInvoiceRow): PurchaseInvoiceRequest => {
    const vendorName = String(invoice.vendorName ?? "").trim();
    const products = invoice.lines.map(toPayloadLine);
    return {
        id: invoice.serverId,
        clientRef: invoice.id,
        invoiceDate: invoice.invoiceDate,
        vendorName,
        paid: invoice.paid,
        products,
    };
};

/** Direction a column starts in on its first tap: dates newest-first, text A→Z, unpaid first. */
export const DEFAULT_SORT_DIR: Record<PurchaseSortKey, SortDir> = {
    invoiceDate: "desc",
    vendorName: "asc",
    unpaid: "asc",
};

/** The order the table opens in: the most recent invoices first. */
export const INITIAL_SORT: { key: PurchaseSortKey; dir: SortDir } = {
    key: "invoiceDate",
    dir: DEFAULT_SORT_DIR.invoiceDate,
};

// Every sortable column compares as a string: invoiceDate is ISO (YYYY-MM-DD), so
// lexicographic order is chronological order. `unpaid` maps to "0"/"1" so that ascending —
// its default direction — puts the unpaid invoices first.
function sortValue(row: PurchaseInvoiceRow, key: PurchaseSortKey): string {
    switch (key) {
        case "invoiceDate":
            return String(row.invoiceDate ?? "").trim();
        case "vendorName":
            return String(row.vendorName ?? "").trim();
        case "unpaid":
            return row.paid ? "1" : "0";
    }
}

/**
 * Reorders a copy of `invoices`. Called only when a header is tapped — the table keeps this order
 * while cells are edited, so a row never jumps out from under the finger of whoever is typing.
 * Invoices still missing the sorted value stay at the bottom in BOTH directions, so a half-filled
 * line is never buried above the completed ones.
 */
export function sortPurchaseInvoices(
    invoices: PurchaseInvoiceRow[],
    key: PurchaseSortKey,
    dir: SortDir,
): PurchaseInvoiceRow[] {
    const factor = dir === "asc" ? 1 : -1;
    return invoices.slice().sort((a, b) => {
        const av = sortValue(a, key);
        const bv = sortValue(b, key);
        if (av === "" || bv === "") {
            if (av === bv) return 0;
            return av === "" ? 1 : -1;
        }
        const primary = factor * av.localeCompare(bv);
        if (primary !== 0) return primary;
        // Grouping by paid state leaves every invoice in a group tied, which would otherwise
        // expose whatever order they happened to arrive in. Keep newest-first inside each group.
        if (key === "unpaid") {
            return String(b.invoiceDate ?? "").localeCompare(String(a.invoiceDate ?? ""));
        }
        return 0;
    });
}

const isFilledNumber = (v: unknown): boolean =>
    Number.isFinite(v) && !Number.isNaN(v) && !toDecimal(v).isZero();

export function validateInvoices(invoices: PurchaseInvoiceRow[]): Map<string, Set<string>> {
    const m = new Map<string, Set<string>>();
    for (const invoice of invoices) {
        if (String(invoice.vendorName ?? "").trim() === "") {
            m.set(invoice.id, new Set(["vendorName"]));
        }
        for (const line of invoice.lines) {
            const fields: string[] = [];
            if (line.productId == null) fields.push("productId");
            if (!isFilledNumber(line.price)) fields.push("price");
            if (!isFilledNumber(line.quantity)) fields.push("quantity");
            if (fields.length) m.set(line.id, new Set(fields));
        }
    }
    return m;
}
