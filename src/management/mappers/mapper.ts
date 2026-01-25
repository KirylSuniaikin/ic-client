import Decimal from "decimal.js-light";
import {InventoryRow, ProductTO} from "../types/inventoryTypes";
import {PurchaseRow} from "../types/purchaseTypes";
import {ProductStatRow} from "../types/productStatRow";


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


export const q3 = (x: Decimal) => x.toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
export const p2 = (x: Decimal) => x.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

export const mapProductToRow = (p: ProductTO): InventoryRow => {
    const price = q3(toDecimal(p.price));
    return {
        productId: p.id,
        name: p.name,
        price,
        isInventory: !!p.isInventory,
        kitchenQuantity: q3(new Decimal(0)),
        storageQuantity: q3(new Decimal(0)),
        finalPrice: q3(new Decimal(0)),
    };
};

export const withRecalc = (row: InventoryRow, kitchenQuantity: string, storageQuantity: string): InventoryRow => {
    const qty = q3(toDecimal(kitchenQuantity)).add(q3(toDecimal(storageQuantity)));
    const sum = p2(qty.mul(row.price));
    return { ...row,
        kitchenQuantity: q3(toDecimal(kitchenQuantity)),
        storageQuantity: q3(toDecimal(storageQuantity)),
        finalPrice: sum };
};

export const rowToPayloadNumber = (r: InventoryRow) => ({
    id: r.productId,
    kitchenQuantity: Number(r.kitchenQuantity.toFixed(3)),
    storageQuantity: Number(r.storageQuantity.toFixed(3)),
    finalPrice: Number(r.finalPrice.toFixed(4))
});

export function normalizeReportPayload(payload: any): InventoryRow[] {
    const items = payload?.inventoryProducts ?? [];
    return items.map((ip: any) => {
        const p = ip?.product ?? {};
        return {
            productId: Number(p.id),
            name: String(p.name ?? ""),
            kitchenQuantity: toDecimal(ip.kitchenQuantity),
            storageQuantity: toDecimal(ip.storageQuantity),
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
    const finalPrice = Number(toDecimal(r.finalPrice).toFixed(3));
    if (Number.isNaN(qty) || Number.isNaN(price) || Number.isNaN(finalPrice)) {
        throw new Error(`Row ${r.id}: invalid quantity, price or total`);
    }
    return {
        id: r.productId,
        quantity: qty,
        price,
        finalPrice: finalPrice,
        vendorName: (r.vendorName).trim(),
        purchaseDate: r.purchaseDate
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

export function productTOConverter(products: ProductTO[]): ProductStatRow[]{
    return products.map((product: ProductTO) => {
        return {
            id: product.id,
            name: product.name,
            price: product.price,
            targetPrice: product.targetPrice
        };
    });
}

// export function normalizeReportPayload(payload: any): InventoryRow[] {
//     const items = payload?.inventoryProducts ?? [];
//     return items.map((ip: any) => {
//         const p = ip?.product ?? {};
//         return {
//             productId: Number(p.id),
//             name: String(p.name ?? ""),
//             quantity: toDecimal(ip.quantity),
//             finalPrice: toDecimal(ip.finalPrice ?? ip.totalPrice ?? 0),
//             price: toDecimal(p.price ?? 0),
//             isInventory: Boolean(p.isInventory),
//         };
//     });
// }
