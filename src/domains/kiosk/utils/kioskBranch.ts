import { DEFAULT_BRANCH_ID } from "../../../shared/api/client";
import type { IBranch } from "../../management/inventory/types";

// Single home for the 'kiosk_branch_data' localStorage literal — previously duplicated inline in
// HomePageModals.tsx, useMenuData.ts and useCheckout.ts. This module only *creates* the shared
// util; the three call sites are migrated to it in later phases (7 and 8), not here.
export const KIOSK_BRANCH_KEY = "kiosk_branch_data";

/**
 * Reads the branch a kiosk device was paired to. Malformed/missing data is treated as "not set"
 * (returns null) rather than thrown — a customer-facing screen must never crash on a corrupted
 * localStorage value.
 */
export function readKioskBranch(): IBranch | null {
    const raw = localStorage.getItem(KIOSK_BRANCH_KEY);
    if (!raw) return null;
    try {
        // JSON.parse returns `any`; the shape is validated by the `parsed?.id` guard below —
        // anything that isn't an IBranch-shaped object (or is a primitive/array) simply fails
        // that guard and falls through to null, so the assertion itself is never trusted blindly.
        const parsed = JSON.parse(raw) as IBranch;
        return parsed?.id ? parsed : null;
    } catch {
        return null;
    }
}

export function writeKioskBranch(branch: IBranch): void {
    localStorage.setItem(KIOSK_BRANCH_KEY, JSON.stringify(branch));
}

/**
 * Same fallback chain useMenuData.ts's current inline `resolveBranchId` already implements for
 * its kiosk arm, just centralized: stored branch id if present, else the public default.
 */
export function resolveKioskBranchId(): string {
    return readKioskBranch()?.id ?? DEFAULT_BRANCH_ID;
}
