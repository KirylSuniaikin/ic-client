import Decimal from "decimal.js-light";
import {InventoryRow, ProductTO} from "./types";

const toDecimal = (v: number | string | Decimal | undefined, number: number) =>
    v instanceof Decimal ? v : new Decimal(v ?? 0);

const q3 = (x: Decimal) => x.toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
const p2 = (x: Decimal) => x.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

export const mapProductToRow = (p: ProductTO): InventoryRow => {
    const price = p2(toDecimal(p.price, 0));
    return {
        productId: p.id,
        name: p.name,
        price,
        isInventory: !!p.isInventory,
        quantity: q3(new Decimal(0)),
        finalPrice: p2(new Decimal(0)),
    };
};

export const withRecalc = (row: InventoryRow, input: string): InventoryRow => {
    const qty = q3(toDecimal(input, 0));
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
            quantity: toDecimal(ip.quantity, 0),
            finalPrice: toDecimal(ip.finalPrice ?? ip.totalPrice ?? 0, 0),
            price: toDecimal(p.price ?? 0, 0),
            isInventory: Boolean(p.isInventory),
        };
    });
}
