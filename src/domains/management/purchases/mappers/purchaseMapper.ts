import { PurchaseRow, PurchaseSortKey, SortDir } from "../types";
import { toDecimal } from "../../../../shared/utils/decimalUtils";

export { toDecimal, p2, q3 } from "../../../../shared/utils/decimalUtils";

export const toPayloadLine = (r: PurchaseRow): {
    id: number;
    quantity: number;
    price: number;
    finalPrice: number;
    vendorName: string;
    purchaseDate: string;
} => {
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
        vendorName: (r.vendorName).trim(),
        purchaseDate: r.purchaseDate,
    };
};

/** Direction a column starts in on its first tap: dates newest-first, text A→Z. */
export const DEFAULT_SORT_DIR: Record<PurchaseSortKey, SortDir> = {
    purchaseDate: "desc",
    product: "asc",
    vendorName: "asc",
};

// Every sortable column compares as a string: purchaseDate is ISO (YYYY-MM-DD), so
// lexicographic order is chronological order.
function sortValue(
    row: PurchaseRow,
    key: PurchaseSortKey,
    productName: (productId: number | null) => string,
): string {
    switch (key) {
        case "purchaseDate":
            return String(row.purchaseDate ?? "").trim();
        case "product":
            return productName(row.productId).trim();
        case "vendorName":
            return String(row.vendorName ?? "").trim();
    }
}

/**
 * Reorders a copy of `rows`. Called only when a header is tapped — the table keeps this order
 * while cells are edited, so a row never jumps out from under the finger of whoever is typing.
 * Rows still missing the sorted value stay at the bottom in BOTH directions, so a half-filled
 * line is never buried above the completed ones.
 */
export function sortPurchaseRows(
    rows: PurchaseRow[],
    key: PurchaseSortKey,
    dir: SortDir,
    productName: (productId: number | null) => string,
): PurchaseRow[] {
    const factor = dir === "asc" ? 1 : -1;
    return rows.slice().sort((a, b) => {
        const av = sortValue(a, key, productName);
        const bv = sortValue(b, key, productName);
        if (av === "" || bv === "") {
            if (av === bv) return 0;
            return av === "" ? 1 : -1;
        }
        return factor * av.localeCompare(bv);
    });
}

const isFilledNumber = (v: unknown): boolean =>
    Number.isFinite(v) && !Number.isNaN(v) && !toDecimal(v).isZero();

export function validateRows(allRows: PurchaseRow[]): Map<string, Set<string>> {
    const m = new Map<string, Set<string>>();
    for (const r of allRows) {
        const fields: string[] = [];
        if (r.productId == null) fields.push("productId");
        if (String(r.vendorName ?? "").trim() === "") fields.push("vendorName");
        if (!isFilledNumber(r.price)) fields.push("price");
        if (!isFilledNumber(r.quantity)) fields.push("quantity");
        if (fields.length) m.set(r.id as string, new Set(fields));
    }
    return m;
}
