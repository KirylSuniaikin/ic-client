import type { IBranch } from "../management/inventory/types";

/** A point on Earth in degrees. Mirrors domains/delivery/types.ts's Coordinates shape; kept
 * local rather than imported so the branch domain has no dependency on the delivery domain. */
export type Coordinates = { latitude: number; longitude: number };

export type BranchDistance = {
    branch: IBranch;
    /** null when the branch has no coordinates, or when no origin is known yet. */
    distanceKm: number | null;
};
