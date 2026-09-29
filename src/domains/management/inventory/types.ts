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
    locale: string;
    // Mirrors BranchTO's nullable latitude/longitude (task-spec.md §5.2) — a branch is often
    // genuinely unseeded with coordinates; both fields must survive null end to end.
    latitude: number | null;
    longitude: number | null;
    // Mirrors BranchTO.address — shown under the branch name in the picker's details sheet.
    // Nullable: a branch can exist before anyone fills its street address in.
    address?: string | null;
    // Mirrors BranchTO.deliveryEnabled — the per-branch delivery switch (gap G2). Optional
    // rather than required: every live payload from /branch/fetch_branches carries it, but
    // declaring it required would force the field into ~20 unrelated branch fixtures that have
    // nothing to do with delivery. `undefined` therefore means "this object did not come from a
    // branch fetch", and the switch says so instead of guessing a default — showing a delivery
    // branch as disabled (or the reverse) is worse than showing nothing.
    deliveryEnabled?: boolean;
    // Mirrors BranchTO.deliveryRadiusKm — how far this kitchen currently delivers, the same number
    // BranchRoutingService applies on every availability check. Recomputed server-side on every
    // read and stored nowhere, so it is never stale.
    //
    // Optional for the same reason deliveryEnabled is: ~20 unrelated branch fixtures have nothing
    // to do with delivery. `undefined` means "this object did not come from a branch fetch", and
    // the zone map draws NO circle in that case rather than guessing a radius — a circle in the
    // wrong place is worse than no circle, because a manager would draw zones against it.
    deliveryRadiusKm?: number;
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
