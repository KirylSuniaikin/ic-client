import { describe, it, expect } from "@jest/globals";
import { sortPurchaseInvoices, toPayloadInvoice, toPayloadLine, validateInvoices } from "./purchaseMapper";
import type { PurchaseInvoiceRow, PurchaseLineRow } from "../types";

const baseLine: PurchaseLineRow = {
    id: "line-1",
    productId: 42,
    price: 10.5,
    quantity: 3,
    finalPrice: 31.5,
};

const baseInvoice: PurchaseInvoiceRow = {
    id: "invoice-1",
    serverId: null,
    invoiceDate: "2025-06-01",
    vendorName: "Al-Wataniya",
    paid: false,
    hasImage: false,
    pendingImage: null,
    removeImage: false,
    lines: [baseLine],
};

describe("toPayloadLine", () => {
    it("maps productId to id", () => {
        const result = toPayloadLine(baseLine);

        expect(result.id).toBe(42);
    });

    it("serialises quantity as number with 3 decimal places", () => {
        const row: PurchaseLineRow = { ...baseLine, quantity: 1.2345 };

        const result = toPayloadLine(row);

        expect(result.quantity).toBe(1.235);
    });

    it("serialises price as number with 4 decimal places", () => {
        const row: PurchaseLineRow = { ...baseLine, price: 5.12345 };

        const result = toPayloadLine(row);

        expect(result.price).toBe(5.1235);
    });

    it("serialises finalPrice as number with 3 decimal places", () => {
        const row: PurchaseLineRow = { ...baseLine, finalPrice: 20.1234 };

        const result = toPayloadLine(row);

        expect(result.finalPrice).toBe(20.123);
    });

    it("throws when productId is null", () => {
        const row: PurchaseLineRow = { ...baseLine, productId: null };

        expect(() => toPayloadLine(row)).toThrow("product is not selected");
    });

    it("converts NaN quantity to 0 without throwing", () => {
        const row: PurchaseLineRow = { ...baseLine, quantity: NaN };

        const result = toPayloadLine(row);

        expect(result.quantity).toBe(0);
    });

    it("converts NaN price to 0 without throwing", () => {
        const row: PurchaseLineRow = { ...baseLine, price: NaN };

        const result = toPayloadLine(row);

        expect(result.price).toBe(0);
    });

    it("converts a null quantity (never-touched cell) to 0 without throwing", () => {
        const row: PurchaseLineRow = { ...baseLine, quantity: null };

        const result = toPayloadLine(row);

        expect(result.quantity).toBe(0);
    });

    it("converts a null price (never-touched cell) to 0 without throwing", () => {
        const row: PurchaseLineRow = { ...baseLine, price: null };

        const result = toPayloadLine(row);

        expect(result.price).toBe(0);
    });

    it("converts a null finalPrice (never-touched cell) to 0 without throwing", () => {
        const row: PurchaseLineRow = { ...baseLine, finalPrice: null };

        const result = toPayloadLine(row);

        expect(result.finalPrice).toBe(0);
    });
});

describe("toPayloadInvoice", () => {
    it("maps serverId to id, row id to clientRef, and passes invoiceDate/paid through unchanged", () => {
        const invoice: PurchaseInvoiceRow = { ...baseInvoice, serverId: 7, paid: true };

        const result = toPayloadInvoice(invoice);

        expect(result.id).toBe(7);
        expect(result.clientRef).toBe("invoice-1");
        expect(result.invoiceDate).toBe("2025-06-01");
        expect(result.paid).toBe(true);
    });

    it("trims whitespace from vendorName", () => {
        const invoice: PurchaseInvoiceRow = { ...baseInvoice, vendorName: "  Vendor B  " };

        const result = toPayloadInvoice(invoice);

        expect(result.vendorName).toBe("Vendor B");
    });

    it("resolves a null vendorName to an empty string without throwing", () => {
        const invoice: PurchaseInvoiceRow = { ...baseInvoice, vendorName: null };

        const result = toPayloadInvoice(invoice);

        expect(result.vendorName).toBe("");
    });

    it("resolves a blank vendorName to an empty string without throwing", () => {
        const invoice: PurchaseInvoiceRow = { ...baseInvoice, vendorName: "   " };

        const result = toPayloadInvoice(invoice);

        expect(result.vendorName).toBe("");
    });

    it("maps every line through the same rounding rules as toPayloadLine", () => {
        const invoice: PurchaseInvoiceRow = {
            ...baseInvoice,
            lines: [{ ...baseLine, quantity: 1.2345, price: 5.12345, finalPrice: 20.1234 }],
        };

        const result = toPayloadInvoice(invoice);

        expect(result.products[0].quantity).toBe(1.235);
        expect(result.products[0].price).toBe(5.1235);
        expect(result.products[0].finalPrice).toBe(20.123);
    });

    it("throws when a line inside lines has no product selected", () => {
        const invoice: PurchaseInvoiceRow = {
            ...baseInvoice,
            lines: [{ ...baseLine, productId: null }],
        };

        expect(() => toPayloadInvoice(invoice)).toThrow("product is not selected");
    });
});

describe("sortPurchaseInvoices", () => {
    const rowA: PurchaseInvoiceRow = { ...baseInvoice, id: "a", invoiceDate: "2025-06-10", vendorName: "Zain" };
    const rowB: PurchaseInvoiceRow = { ...baseInvoice, id: "b", invoiceDate: "2025-06-01", vendorName: "Acme" };
    const rowC: PurchaseInvoiceRow = { ...baseInvoice, id: "c", invoiceDate: "2025-06-20", vendorName: "Metro" };

    const ids = (rows: PurchaseInvoiceRow[]): string[] => rows.map(r => r.id);

    it("orders by invoice date newest first when descending", () => {
        const result = sortPurchaseInvoices([rowA, rowB, rowC], "invoiceDate", "desc");

        expect(ids(result)).toEqual(["c", "a", "b"]);
    });

    it("orders by invoice date oldest first when ascending", () => {
        const result = sortPurchaseInvoices([rowA, rowB, rowC], "invoiceDate", "asc");

        expect(ids(result)).toEqual(["b", "a", "c"]);
    });

    it("orders by vendor name", () => {
        const result = sortPurchaseInvoices([rowA, rowB, rowC], "vendorName", "asc");

        expect(ids(result)).toEqual(["b", "c", "a"]);
    });

    it("keeps rows missing the sorted value at the bottom in both directions", () => {
        const blank: PurchaseInvoiceRow = { ...baseInvoice, id: "blank", vendorName: "" };

        expect(ids(sortPurchaseInvoices([blank, rowA, rowB], "vendorName", "asc"))).toEqual(["b", "a", "blank"]);
        expect(ids(sortPurchaseInvoices([blank, rowA, rowB], "vendorName", "desc"))).toEqual(["a", "b", "blank"]);
    });

    it("returns a new array and leaves the input untouched", () => {
        const input = [rowA, rowB, rowC];

        const result = sortPurchaseInvoices(input, "invoiceDate", "desc");

        expect(result).not.toBe(input);
        expect(ids(input)).toEqual(["a", "b", "c"]);
    });
});

describe("validateInvoices", () => {
    it("returns an empty map when all rows are valid", () => {
        const invoices: PurchaseInvoiceRow[] = [baseInvoice];

        const result = validateInvoices(invoices);

        expect(result.size).toBe(0);
    });

    it("flags productId field on the line id when productId is null", () => {
        const invoice: PurchaseInvoiceRow = { ...baseInvoice, lines: [{ ...baseLine, productId: null }] };

        const result = validateInvoices([invoice]);

        expect(result.get("line-1")?.has("productId")).toBe(true);
    });

    it("flags vendorName field on the invoice id when vendorName is blank", () => {
        const invoice: PurchaseInvoiceRow = { ...baseInvoice, vendorName: "   " };

        const result = validateInvoices([invoice]);

        expect(result.get("invoice-1")?.has("vendorName")).toBe(true);
    });

    it("flags vendorName field on the invoice id when vendorName is null", () => {
        const invoice: PurchaseInvoiceRow = { ...baseInvoice, vendorName: null };

        const result = validateInvoices([invoice]);

        expect(result.get("invoice-1")?.has("vendorName")).toBe(true);
    });

    it("flags price field on the line id when price is zero", () => {
        const invoice: PurchaseInvoiceRow = { ...baseInvoice, lines: [{ ...baseLine, price: 0 }] };

        const result = validateInvoices([invoice]);

        expect(result.get("line-1")?.has("price")).toBe(true);
    });

    it("flags quantity field on the line id when quantity is zero", () => {
        const invoice: PurchaseInvoiceRow = { ...baseInvoice, lines: [{ ...baseLine, quantity: 0 }] };

        const result = validateInvoices([invoice]);

        expect(result.get("line-1")?.has("quantity")).toBe(true);
    });

    it("flags quantity field on the line id when quantity is null, same as an explicit 0", () => {
        const invoice: PurchaseInvoiceRow = { ...baseInvoice, lines: [{ ...baseLine, quantity: null }] };

        const result = validateInvoices([invoice]);

        expect(result.get("line-1")?.has("quantity")).toBe(true);
    });

    it("flags price field on the line id when price is null, same as an explicit 0", () => {
        const invoice: PurchaseInvoiceRow = { ...baseInvoice, lines: [{ ...baseLine, price: null }] };

        const result = validateInvoices([invoice]);

        expect(result.get("line-1")?.has("price")).toBe(true);
    });

    it("does not include a fully valid invoice's ids in the result map", () => {
        // invalidInvoice keeps a valid vendorName (inherited from baseInvoice) — only its line
        // is broken, so the invoice id itself must stay out of the map (key-split: vendorName
        // failures key off the invoice id, productId/price/quantity failures key off the line id).
        const invalidInvoice: PurchaseInvoiceRow = {
            ...baseInvoice,
            id: "invoice-2",
            lines: [{ ...baseLine, id: "line-2", productId: null }],
        };

        const result = validateInvoices([baseInvoice, invalidInvoice]);

        expect(result.has("invoice-1")).toBe(false);
        expect(result.has("line-1")).toBe(false);
        expect(result.has("invoice-2")).toBe(false);
        expect(result.has("line-2")).toBe(true);
    });

    it("collects multiple invalid fields on the same line id", () => {
        const invoice: PurchaseInvoiceRow = {
            ...baseInvoice,
            lines: [{ ...baseLine, productId: null, price: 0 }],
        };

        const result = validateInvoices([invoice]);

        const fields = result.get("line-1");
        expect(fields?.has("productId")).toBe(true);
        expect(fields?.has("price")).toBe(true);
    });

    it("returns an empty map for an empty invoices array", () => {
        const result = validateInvoices([]);

        expect(result.size).toBe(0);
    });

    it("produces no line-level entries for an invoice with zero lines", () => {
        const invoice: PurchaseInvoiceRow = { ...baseInvoice, lines: [] };

        const result = validateInvoices([invoice]);

        expect(result.has("invoice-1")).toBe(false);
        expect(result.size).toBe(0);
    });
});
