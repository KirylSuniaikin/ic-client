/**
 * `DeliveryCard.riskMinutes` under the name of the thing it actually measures.
 *
 * The backend computes it as `Duration.between(readyAt, estimatedDeliveredAt).toMinutes()`
 * (`DeliveryCardService.toCardEntry`): **how many minutes the food will have been out of the oven
 * by the time it reaches the customer.** "risk" was the name of the sort key, not of the figure —
 * and a bare integer captioned `risk` tells a manager nothing at all.
 */
export const FRESHNESS_LABEL = 'Out of the oven on arrival';

/**
 * The budget that figure is supposed to stay inside: the backend's
 * `delivery.freshness.max-minutes-after-ready` (`DeliveryProperties.Freshness`, shipped default
 * 20), which is also the number the whole coverage area is derived from —
 * `radius_km = maxMinutesAfterReady × averageSpeedKmPerMinute`, clamped. A card past it is one
 * whose food will arrive outside the window the delivery radius was drawn around.
 *
 * **The server now sends it on every card** as `DeliveryCard.freshnessBudgetMinutes`, which is
 * what the board reads. This constant survives only as the fallback for a payload written before
 * that field existed, and stays `null` on purpose: a hard-coded copy of a tunable server value
 * would be wrong the first time anyone tuned it — silently, and in the reassuring direction.
 */
export const FRESHNESS_BUDGET_MINUTES: number | null = null;

/**
 * What can honestly be said about one card's figure.
 *
 * `unknown` and `no-budget` are deliberately different: the first is "we do not know how old the
 * food will be", the second is "we know, but we have nothing to judge it against". Collapsing
 * either into "fine" is the failure this whole rework exists to prevent.
 */
export type FreshnessStanding = 'unknown' | 'no-budget' | 'within' | 'over';

export function freshnessStanding(
    minutes: number | null,
    budgetMinutes: number | null
): FreshnessStanding {
    if (minutes === null) return 'unknown';
    // A non-positive budget is not a budget; treating it as one would divide by zero in the bar
    // and mark every order in the city as late.
    if (budgetMinutes === null || budgetMinutes <= 0) return 'no-budget';
    return minutes > budgetMinutes ? 'over' : 'within';
}

/**
 * The figure as words. Never "0 min" and never a bare number: a null is "not known", and a known
 * value carries its unit and — when there is one — the budget it is being read against.
 */
export function freshnessText(minutes: number | null, budgetMinutes: number | null): string {
    if (minutes === null) return 'not known';
    if (budgetMinutes === null || budgetMinutes <= 0) return `${minutes} min`;
    return `${minutes} of ${budgetMinutes} min`;
}

/**
 * How much of the budget bar is filled, 0–1. Clamped, because an order three times over budget
 * must not draw a bar three times the width of its own track — the overshoot is already stated in
 * the text beside it.
 */
export function freshnessFill(minutes: number, budgetMinutes: number): number {
    if (budgetMinutes <= 0) return 0;
    return Math.max(0, Math.min(1, minutes / budgetMinutes));
}
