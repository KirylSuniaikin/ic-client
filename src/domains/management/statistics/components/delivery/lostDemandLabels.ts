import type {DemandPlatform, DemandStage, LostDemandReason} from "../../types";

// Shared by the lost-demand card and the zones card's "Turned away" view, so one reason never
// reads two ways on the same tab.

// Each reason kept apart, never blended into "unavailable": a branch switched off, a courier
// shortage and an address out of reach are three different decisions.
export const LOST_DEMAND_REASON_LABELS: Record<LostDemandReason | "UNKNOWN", string> = {
    NO_BRANCH: "No branch coordinates",
    // The gate returns this for both the straight-line radius and the drive-time budget.
    OUTSIDE_RADIUS: "Too far (radius or drive time)",
    NO_COURIER: "No courier",
    DELIVERY_DISABLED: "Delivery switched off",
    OUTSIDE_ZONE: "Outside the delivery zones",
    INSUFFICIENT_COURIERS: "Not enough couriers for the basket",
    UNKNOWN: "Reason not sent",
};

export const DEMAND_STAGE_LABELS: Record<DemandStage, string> = {
    CART: "Cart (before an address)",
    ADDRESS: "Address pinned",
    CHECKOUT: "At payment",
};

export const DEMAND_PLATFORM_LABELS: Record<DemandPlatform, string> = {
    WEB: "Website",
    MOBILE: "App",
    KIOSK: "Kiosk",
    KIOSK_WEB: "Kiosk (web)",
    UNKNOWN: "Unknown",
};
