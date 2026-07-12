import Decimal from "decimal.js-light";
import { InventoryRow, ProductTO } from "../types";
import { ProductStatRow } from "../../statistics/types";
import { toDecimal, p2, q3 } from "../../../../shared/utils/decimalUtils";

export { toDecimal, p2, q3 } from "../../../../shared/utils/decimalUtils";

export const mapProductToRow = (p: ProductTO): InventoryRow => {
    const price = q3(toDecimal(p.price));
    return {
        productId: p.id,
        name: p.name,
        price,
        isInventory: !!p.isInventory,
        kitchenQuantity: null,
        storageQuantity: null,
        finalPrice: q3(new Decimal(0)),
    };
};

export const withRecalc = (row: InventoryRow, kitchenQuantity: string, storageQuantity: string): InventoryRow => {
    const qty = q3(toDecimal(kitchenQuantity)).add(q3(toDecimal(storageQuantity)));
    const sum = p2(qty.mul(row.price));
    return {
        ...row,
        kitchenQuantity: q3(toDecimal(kitchenQuantity)),
        storageQuantity: q3(toDecimal(storageQuantity)),
        finalPrice: sum,
    };
};

export const rowToPayloadNumber = (r: InventoryRow): { id: number; kitchenQuantity: number; storageQuantity: number; finalPrice: number } => ({
    id: r.productId,
    kitchenQuantity: Number((r.kitchenQuantity ?? new Decimal(0)).toFixed(3)),
    storageQuantity: Number((r.storageQuantity ?? new Decimal(0)).toFixed(3)),
    finalPrice: Number(r.finalPrice.toFixed(4)),
});

export function normalizeReportPayload(payload: unknown): InventoryRow[] {
    const obj = payload as { inventoryProducts?: unknown[] } | null;
    const items = obj?.inventoryProducts ?? [];
    return (items as unknown[]).map((ip: unknown) => {
        const item = ip as { product?: Record<string, unknown>; kitchenQuantity?: unknown; storageQuantity?: unknown; finalPrice?: unknown; totalPrice?: unknown };
        const p = (item?.product ?? {}) as Record<string, unknown>;
        return {
            productId: Number(p['id']),
            name: String(p['name'] ?? ""),
            kitchenQuantity: toDecimal(item.kitchenQuantity),
            storageQuantity: toDecimal(item.storageQuantity),
            finalPrice: toDecimal(item.finalPrice ?? item.totalPrice ?? 0),
            price: toDecimal(p['price'] ?? 0),
            isInventory: Boolean(p['isInventory']),
        };
    });
}

export function productTOConverter(products: ProductTO[]): ProductStatRow[] {
    return products.map((product: ProductTO) => ({
        id: product.id,
        name: product.name,
        price: product.price,
        targetPrice: product.targetPrice,
    }));
}
