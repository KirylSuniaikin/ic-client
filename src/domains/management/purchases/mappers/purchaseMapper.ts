import { PurchaseRow } from "../types";
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
