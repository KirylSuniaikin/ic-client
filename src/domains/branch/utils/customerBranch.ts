import { CHOSEN_BRANCH_KEY } from "../constants";
import type { IBranch } from "../../management/inventory/types";

/**
 * Reads the branch an ordinary customer chose in the branch picker. Malformed/missing data is
 * treated as "not set" (returns null) rather than thrown — a customer-facing screen must never
 * crash on a corrupted localStorage value. Mirrors domains/kiosk/utils/kioskBranch.ts exactly,
 * under a different key.
 */
export function readChosenBranch(): IBranch | null {
    const raw = localStorage.getItem(CHOSEN_BRANCH_KEY);
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

export function writeChosenBranch(branch: IBranch): void {
    localStorage.setItem(CHOSEN_BRANCH_KEY, JSON.stringify(branch));
}

export function clearChosenBranch(): void {
    localStorage.removeItem(CHOSEN_BRANCH_KEY);
}
