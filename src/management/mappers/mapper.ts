import Decimal from "decimal.js-light";
import {InventoryRow, ProductTO} from "../types/inventoryTypes";
import {PurchaseRow} from "../types/purchaseTypes";

export function toDecimal(v: unknown): Decimal {
    if (v instanceof Decimal) return v;
    if (v === null || v === undefined) return new Decimal(0);
    if (typeof v === "number") return Number.isFinite(v) ? new Decimal(v) : new Decimal(0);
    if (typeof v === "string") {
        const s = v.trim().replace(",", ".");
        if (s === "" || s === "-" || s === "." || s === "-.") return new Decimal(0);
        if (!/^-?\d+(\.\d+)?$/.test(s)) return new Decimal(0);
        return new Decimal(s);
    }
    return new Decimal(0);
}

export function toDecimalStrict(v: unknown): Decimal {
    if (v instanceof Decimal) return v;
    if (v === null || v === undefined) return new Decimal(NaN);

    if (typeof v === "number") {
        return Number.isFinite(v) ? new Decimal(v) : new Decimal(NaN);
    }

    if (typeof v === "string") {
        const s = v.trim().replace(",", ".");
        // НЕ считаем переходные значения за ноль
        if (s === "" || s === "-" || s === "." || s === "-.") return new Decimal(NaN);
        // принимаем: "12", "12.", "12.3", ".5", "-.5"
        const ok = /^-?(?:\d+\.?\d*|\.\d+)$/.test(s);
        return ok ? new Decimal(s) : new Decimal(NaN);
    }

    return new Decimal(NaN);
}

export function parseDecimalLoose(v: unknown): Decimal | null {
    if (v instanceof Decimal) return v;
    if (v === null || v === undefined) return null;
    if (typeof v === "number") return Number.isFinite(v) ? new Decimal(v) : null;
    if (typeof v === "string") {
        const s = v.trim().replace(",", ".");
        if (s === "" || s === "-" || s === "." || s === "-." || /^-?\d+\.?$/.test(s)) return null;
        if (/^-?\d+(\.\d+)?$/.test(s)) return new Decimal(s);
        return null;
    }
    return null;
}

export const q3 = (x: Decimal) => x.toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
export const p2 = (x: Decimal) => x.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

export const mapProductToRow = (p: ProductTO): InventoryRow => {
    const price = q3(toDecimal(p.price));
    return {
        productId: p.id,
        name: p.name,
        price,
        isInventory: !!p.isInventory,
        quantity: q3(new Decimal(0)),
        finalPrice: q3(new Decimal(0)),
    };
};

export const withRecalc = (row: InventoryRow, input: string): InventoryRow => {
    const qty = q3(toDecimal(input));
    const sum = p2(qty.mul(row.price));
    return { ...row, quantity: qty, finalPrice: sum };
};

export const rowToPayloadNumber = (r: InventoryRow) => ({
    id: r.productId,
    quantity: Number(r.quantity.toFixed(3)),
    finalPrice: Number(r.finalPrice.toFixed(4))
});

export function normalizeReportPayload(payload: any): InventoryRow[] {
    const items = payload?.inventoryProducts ?? [];
    return items.map((ip: any) => {
        const p = ip?.product ?? {};
        return {
            productId: Number(p.id),
            name: String(p.name ?? ""),
            quantity: toDecimal(ip.quantity),
            finalPrice: toDecimal(ip.finalPrice ?? ip.totalPrice ?? 0),
            price: toDecimal(p.price ?? 0),
            isInventory: Boolean(p.isInventory),
        };
    });
}

export const toPayloadLine = (r: PurchaseRow) => {
    if (r.productId == null) throw new Error(`Row ${r.id}: product is not selected`);
    const qty   = Number(toDecimal(r.quantity).toFixed(3));
    const price = Number(toDecimal(r.price).toFixed(4));
    if (Number.isNaN(qty) || Number.isNaN(price)) {
        throw new Error(`Row ${r.id}: invalid quantity or price`);
    }
    return {
        id: r.productId,
        quantity: qty,
        price,
        finalPrice: Number(
            toDecimal(qty).mul(toDecimal(price)).toDecimalPlaces(4).toFixed(4)
        ),
        vendorName: (r.vendorName).trim(),
    };
};

const isFilledNumber = (v: unknown) => Number.isFinite(v) && !Number.isNaN(v) && !toDecimal(v).isZero();

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