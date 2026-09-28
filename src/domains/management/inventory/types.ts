import Decimal from "decimal.js-light";
import type { MeasureUnit } from "../../../shared/utils/unitFormat";

export type ReportType =
    | "INVENTORY"
    | "PURCHASE"
    | "PRODUCT_CONSUMPTION"
    | "SHIFT_REPORT"

export interface IManagementResponse {
    id: number;
    type: ReportType;
    title: string;
    createdAt: string;
    branchNo: number;
    userName: string;
    finalPrice: number;
}

export interface IBranch {
    // Branch IDs are UUIDs (from the backend BranchTO); TS has no UUID primitive, so string.
    id: string;
    externalId: string;
    branchNo: number;
    branchName: string;
    locale: string
}

export interface IUser {
    id: number;
    userName: string;
}

export type ProductTO = {
    id: number;
    name: string;
    targetPrice: number;
    // Null for a product created from the UI that has not been bought yet: the price is filled in
    // by the first purchase (ProductService.overwritePrices), never typed by hand.
    price: number | null;
    isInventory: boolean;
    isPurchasable: boolean;
    isBundle: boolean;
    topVendor: string | null;
    unit?: MeasureUnit | null;
}

// POST /api/products. Everything a product has that is not listed here starts null/false on the
// server (price, is_bundle) -- see ProductTO.price.
export type CreateProductRequest = {
    name: string;
    targetPrice: number;
    unit: MeasureUnit;
    /** A vendor's exact vendorName, or null for none. */
    topVendor: string | null;
    isInventory: boolean;
    isPurchasable: boolean;
};

// PATCH /api/products/{id}/settings. Always the FULL set of the four inline-editable fields, so a
// null topVendor means "clear it". unit may be null because legacy rows were backfilled by hand
// and some still have none -- toggling a switch on such a row must not be refused for it.
export type UpdateProductSettingsRequest = {
    isInventory: boolean;
    isPurchasable: boolean;
    unit: MeasureUnit | null;
    topVendor: string | null;
};

export const DUPLICATE_PRODUCT_NAME_MESSAGE = "A product with this name already exists";

// Thrown by createProduct on a 409 -- the server compares names trimmed, whitespace-collapsed and
// case-insensitively (see normalizeProductName), so this can fire even when the client-side check
// passed against a product list loaded before someone else added the same name.
export class DuplicateProductNameError extends Error {
    constructor() {
        super(DUPLICATE_PRODUCT_NAME_MESSAGE);
        this.name = "DuplicateProductNameError";
    }
}

export type ReportInventoryProductDTO = {
    product: ProductTO;
    kitchenQuantity: number;
    storageQuantity: number;
    finalPrice: number;
};

export type ReportTO = {
    id: number;
    title: string;
    branchNo: number;
    userId: number;
    finalPrice: number;
    inventoryProducts: ReportInventoryProductDTO[];
}

export type InventoryRow = {
    productId: number;
    name: string;
    kitchenQuantity: Decimal | null;
    storageQuantity: Decimal | null;
    finalPrice: Decimal;
    price: Decimal;
    isInventory: boolean;
    unit: MeasureUnit | null;
}
