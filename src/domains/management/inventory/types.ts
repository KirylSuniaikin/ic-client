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
    price: number;
    isInventory: boolean;
    isPurchasable: boolean;
    isBundle: boolean;
    topVendor: string;
    unit?: MeasureUnit | null;
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
