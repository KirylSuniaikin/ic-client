import { describe, it, expect } from "@jest/globals";
import { toPayloadLine, validateRows } from "./purchaseMapper";
import type { PurchaseRow } from "../types";

const baseRow: PurchaseRow = {
    id: "row-1",
    purchaseDate: "2025-06-01",
    productId: 42,
    price: 10.5,
    quantity: 3,
    finalPrice: 31.5,
    vendorName: "Al-Wataniya",
};

describe("toPayloadLine", () => {
    it("maps productId to id", () => {
        const result = toPayloadLine(baseRow);

        expect(result.id).toBe(42);
    });

    it("serialises quantity as number with 3 decimal places", () => {
        const row: PurchaseRow = { ...baseRow, quantity: 1.2345 };

        const result = toPayloadLine(row);

        expect(result.quantity).toBe(1.235);
    });

    it("serialises price as number with 4 decimal places", () => {
        const row: PurchaseRow = { ...baseRow, price: 5.12345 };

        const result = toPayloadLine(row);

        expect(result.price).toBe(5.1235);
    });

    it("serialises finalPrice as number with 3 decimal places", () => {
        const row: PurchaseRow = { ...baseRow, finalPrice: 20.1234 };

        const result = toPayloadLine(row);

        expect(result.finalPrice).toBe(20.123);
    });

    it("trims whitespace from vendorName", () => {
        const row: PurchaseRow = { ...baseRow, vendorName: "  Vendor B  " };

        const result = toPayloadLine(row);

        expect(result.vendorName).toBe("Vendor B");
    });

    it("passes purchaseDate through unchanged", () => {
        const result = toPayloadLine(baseRow);

        expect(result.purchaseDate).toBe("2025-06-01");
    });

    it("throws when productId is null", () => {
        const row: PurchaseRow = { ...baseRow, productId: null };

        expect(() => toPayloadLine(row)).toThrow("product is not selected");
    });

    it("converts NaN quantity to 0 without throwing", () => {
        const row: PurchaseRow = { ...baseRow, quantity: NaN };

        const result = toPayloadLine(row);

        expect(result.quantity).toBe(0);
    });

    it("converts NaN price to 0 without throwing", () => {
        const row: PurchaseRow = { ...baseRow, price: NaN };

        const result = toPayloadLine(row);

        expect(result.price).toBe(0);
    });

    it("converts a null quantity (never-touched cell) to 0 without throwing", () => {
        const row: PurchaseRow = { ...baseRow, quantity: null };

        const result = toPayloadLine(row);

        expect(result.quantity).toBe(0);
    });

    it("converts a null price (never-touched cell) to 0 without throwing", () => {
        const row: PurchaseRow = { ...baseRow, price: null };

        const result = toPayloadLine(row);

        expect(result.price).toBe(0);
    });

    it("converts a null finalPrice (never-touched cell) to 0 without throwing", () => {
        const row: PurchaseRow = { ...baseRow, finalPrice: null };

        const result = toPayloadLine(row);

        expect(result.finalPrice).toBe(0);
    });
});

describe("validateRows", () => {
    it("returns an empty map when all rows are valid", () => {
        const rows: PurchaseRow[] = [baseRow];

        const result = validateRows(rows);

        expect(result.size).toBe(0);
    });

    it("flags productId field when productId is null", () => {
        const row: PurchaseRow = { ...baseRow, productId: null };

        const result = validateRows([row]);

        expect(result.get("row-1")?.has("productId")).toBe(true);
    });

    it("flags vendorName field when vendorName is blank", () => {
        const row: PurchaseRow = { ...baseRow, vendorName: "   " };

        const result = validateRows([row]);

        expect(result.get("row-1")?.has("vendorName")).toBe(true);
    });

    it("flags vendorName field when vendorName is null", () => {
        const row: PurchaseRow = { ...baseRow, vendorName: null };

        const result = validateRows([row]);

        expect(result.get("row-1")?.has("vendorName")).toBe(true);
    });

    it("flags price field when price is zero", () => {
        const row: PurchaseRow = { ...baseRow, price: 0 };

        const result = validateRows([row]);

        expect(result.get("row-1")?.has("price")).toBe(true);
    });

    it("flags quantity field when quantity is zero", () => {
        const row: PurchaseRow = { ...baseRow, quantity: 0 };

        const result = validateRows([row]);

        expect(result.get("row-1")?.has("quantity")).toBe(true);
    });

    it("flags quantity field when quantity is null (never-touched cell), same as an explicit 0", () => {
        const row: PurchaseRow = { ...baseRow, quantity: null };

        const result = validateRows([row]);

        expect(result.get("row-1")?.has("quantity")).toBe(true);
    });

    it("flags price field when price is null (never-touched cell), same as an explicit 0", () => {
        const row: PurchaseRow = { ...baseRow, price: null };

        const result = validateRows([row]);

        expect(result.get("row-1")?.has("price")).toBe(true);
    });

    it("does not include valid rows in the result map", () => {
        const rows: PurchaseRow[] = [baseRow, { ...baseRow, id: "row-2", productId: null }];

        const result = validateRows(rows);

        expect(result.has("row-1")).toBe(false);
        expect(result.has("row-2")).toBe(true);
    });

    it("collects multiple invalid fields for the same row", () => {
        const row: PurchaseRow = { ...baseRow, productId: null, vendorName: "" };

        const result = validateRows([row]);

        const fields = result.get("row-1");
        expect(fields?.has("productId")).toBe(true);
        expect(fields?.has("vendorName")).toBe(true);
    });

    it("returns an empty map for an empty rows array", () => {
        const result = validateRows([]);

        expect(result.size).toBe(0);
    });
});
