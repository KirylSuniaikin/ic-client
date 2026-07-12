import { describe, it, expect } from "@jest/globals";
import Decimal from "decimal.js-light";
import {
    mapProductToRow,
    withRecalc,
    rowToPayloadNumber,
    normalizeReportPayload,
    productTOConverter,
} from "./inventoryMapper";
import type { ProductTO, InventoryRow } from "../types";

const baseProduct: ProductTO = {
    id: 1,
    name: "Mozzarella",
    price: 12.5,
    targetPrice: 10,
    isInventory: true,
    isPurchasable: true,
    isBundle: false,
    topVendor: "VendorA",
};

describe("mapProductToRow", () => {
    it("maps product id to productId", () => {
        const result = mapProductToRow(baseProduct);

        expect(result.productId).toBe(1);
    });

    it("maps product name", () => {
        const result = mapProductToRow(baseProduct);

        expect(result.name).toBe("Mozzarella");
    });

    it("maps product price as a Decimal rounded to 3 dp", () => {
        const result = mapProductToRow(baseProduct);

        expect(result.price.toNumber()).toBeCloseTo(12.5);
    });

    it("sets kitchenQuantity to null (never-touched cell, not a stored zero)", () => {
        const result = mapProductToRow(baseProduct);

        expect(result.kitchenQuantity).toBeNull();
    });

    it("sets storageQuantity to null (never-touched cell, not a stored zero)", () => {
        const result = mapProductToRow(baseProduct);

        expect(result.storageQuantity).toBeNull();
    });

    it("sets finalPrice to Decimal(0)", () => {
        const result = mapProductToRow(baseProduct);

        expect(result.finalPrice.toNumber()).toBe(0);
    });

    it("maps isInventory flag correctly when true", () => {
        const result = mapProductToRow(baseProduct);

        expect(result.isInventory).toBe(true);
    });

    it("maps isInventory flag correctly when falsy (undefined-ish)", () => {
        const product: ProductTO = { ...baseProduct, isInventory: false };

        const result = mapProductToRow(product);

        expect(result.isInventory).toBe(false);
    });
});

describe("withRecalc", () => {
    const baseRow: InventoryRow = {
        productId: 1,
        name: "Mozzarella",
        price: new Decimal("5"),
        kitchenQuantity: new Decimal("0"),
        storageQuantity: new Decimal("0"),
        finalPrice: new Decimal("0"),
        isInventory: true,
    };

    it("sets kitchenQuantity from the string argument", () => {
        const result = withRecalc(baseRow, "2", "0");

        expect(result.kitchenQuantity.toFixed(3)).toBe("2.000");
    });

    it("sets storageQuantity from the string argument", () => {
        const result = withRecalc(baseRow, "0", "3");

        expect(result.storageQuantity.toFixed(3)).toBe("3.000");
    });

    it("calculates finalPrice as (kitchen + storage) * price, rounded to 2 dp", () => {
        // (2 + 3) * 5 = 25.00
        const result = withRecalc(baseRow, "2", "3");

        expect(result.finalPrice.toFixed(2)).toBe("25.00");
    });

    it("handles decimal quantities — (1.5 + 0.5) * 4 = 8.00", () => {
        const row: InventoryRow = { ...baseRow, price: new Decimal("4") };

        const result = withRecalc(row, "1.5", "0.5");

        expect(result.finalPrice.toFixed(2)).toBe("8.00");
    });

    it("does not mutate the original row", () => {
        withRecalc(baseRow, "10", "5");

        expect(baseRow.kitchenQuantity.toNumber()).toBe(0);
        expect(baseRow.storageQuantity.toNumber()).toBe(0);
    });
});

describe("rowToPayloadNumber", () => {
    const row: InventoryRow = {
        productId: 7,
        name: "Cheese",
        price: new Decimal("3"),
        kitchenQuantity: new Decimal("1.1234"),
        storageQuantity: new Decimal("2.5678"),
        finalPrice: new Decimal("11.1234"),
        isInventory: true,
    };

    it("maps productId to id", () => {
        const result = rowToPayloadNumber(row);

        expect(result.id).toBe(7);
    });

    it("serialises kitchenQuantity as number with 3 decimal places", () => {
        const result = rowToPayloadNumber(row);

        expect(result.kitchenQuantity).toBe(1.123);
    });

    it("serialises storageQuantity as number with 3 decimal places", () => {
        const result = rowToPayloadNumber(row);

        expect(result.storageQuantity).toBe(2.568);
    });

    it("serialises finalPrice as number with 4 decimal places", () => {
        const result = rowToPayloadNumber(row);

        expect(result.finalPrice).toBe(11.1234);
    });

    it("serialises a null kitchenQuantity as 0 (never-touched cell)", () => {
        const nullRow: InventoryRow = { ...row, kitchenQuantity: null };

        const result = rowToPayloadNumber(nullRow);

        expect(result.kitchenQuantity).toBe(0);
    });

    it("serialises a null storageQuantity as 0 (never-touched cell)", () => {
        const nullRow: InventoryRow = { ...row, storageQuantity: null };

        const result = rowToPayloadNumber(nullRow);

        expect(result.storageQuantity).toBe(0);
    });
});

describe("normalizeReportPayload", () => {
    it("returns an empty array for null input", () => {
        const result = normalizeReportPayload(null);

        expect(result).toHaveLength(0);
    });

    it("returns an empty array when inventoryProducts is absent", () => {
        const result = normalizeReportPayload({});

        expect(result).toHaveLength(0);
    });

    it("returns an empty array for an empty inventoryProducts array", () => {
        const result = normalizeReportPayload({ inventoryProducts: [] });

        expect(result).toHaveLength(0);
    });

    it("maps each inventory product to an InventoryRow", () => {
        const payload = {
            inventoryProducts: [
                {
                    product: { id: 3, name: "Basil", price: 2.5, isInventory: true },
                    kitchenQuantity: 1,
                    storageQuantity: 2,
                    finalPrice: 7.5,
                },
            ],
        };

        const result = normalizeReportPayload(payload);

        expect(result).toHaveLength(1);
        expect(result[0].productId).toBe(3);
        expect(result[0].name).toBe("Basil");
    });

    it("uses totalPrice as finalPrice fallback when finalPrice is absent", () => {
        const payload = {
            inventoryProducts: [
                {
                    product: { id: 5, name: "Oregano", price: 1, isInventory: false },
                    kitchenQuantity: 0,
                    storageQuantity: 0,
                    totalPrice: 9.99,
                },
            ],
        };

        const result = normalizeReportPayload(payload);

        expect(result[0].finalPrice.toNumber()).toBeCloseTo(9.99);
    });

    it("maps isInventory from the nested product", () => {
        const payload = {
            inventoryProducts: [
                {
                    product: { id: 9, name: "Tomato", price: 1, isInventory: false },
                    kitchenQuantity: 0,
                    storageQuantity: 0,
                    finalPrice: 0,
                },
            ],
        };

        const result = normalizeReportPayload(payload);

        expect(result[0].isInventory).toBe(false);
    });
});

describe("productTOConverter", () => {
    it("returns an empty array for empty input", () => {
        const result = productTOConverter([]);

        expect(result).toHaveLength(0);
    });

    it("maps id, name, price and targetPrice for each product", () => {
        const products: ProductTO[] = [
            { ...baseProduct, id: 10, name: "Pepperoni", price: 8, targetPrice: 6 },
        ];

        const result = productTOConverter(products);

        expect(result[0].id).toBe(10);
        expect(result[0].name).toBe("Pepperoni");
        expect(result[0].price).toBe(8);
        expect(result[0].targetPrice).toBe(6);
    });

    it("converts multiple products preserving order", () => {
        const products: ProductTO[] = [
            { ...baseProduct, id: 1, name: "A" },
            { ...baseProduct, id: 2, name: "B" },
        ];

        const result = productTOConverter(products);

        expect(result[0].name).toBe("A");
        expect(result[1].name).toBe("B");
    });
});
