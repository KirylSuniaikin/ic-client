import { describe, it, expect } from "@jest/globals";
import {
    FRESHNESS_BUDGET_MINUTES, freshnessFill, freshnessStanding, freshnessText,
} from "./freshness";

/**
 * The card's headline figure is `DeliveryCardTO.riskMinutes` — minutes between the food leaving
 * the oven and reaching the customer — and the budget it is read against is the backend's
 * `delivery.freshness.max-minutes-after-ready`.
 *
 * These cases exist because every one of the four states means something different to a manager,
 * and three of them have historically been rendered as the fourth.
 */
describe("freshnessStanding", () => {
    it("separates 'we do not know' from 'we know but have nothing to judge it against'", () => {
        expect(freshnessStanding(null, 20)).toBe("unknown");
        expect(freshnessStanding(null, null)).toBe("unknown");
        expect(freshnessStanding(26, null)).toBe("no-budget");
    });

    it("puts the boundary itself inside the budget, not outside it", () => {
        expect(freshnessStanding(20, 20)).toBe("within");
        expect(freshnessStanding(21, 20)).toBe("over");
    });

    /** A zero or negative budget is not a budget; honouring it would mark the whole city late. */
    it("refuses to treat a non-positive budget as one", () => {
        expect(freshnessStanding(5, 0)).toBe("no-budget");
        expect(freshnessStanding(5, -3)).toBe("no-budget");
    });
});

describe("freshnessText", () => {
    it("never renders an absent figure as zero", () => {
        expect(freshnessText(null, 20)).toBe("not known");
        expect(freshnessText(null, null)).toBe("not known");
    });

    it("carries the unit, and the budget when there is one", () => {
        expect(freshnessText(26, 20)).toBe("26 of 20 min");
        expect(freshnessText(26, null)).toBe("26 min");
        expect(freshnessText(0, 20)).toBe("0 of 20 min");
    });
});

describe("freshnessFill", () => {
    it("clamps an overshoot instead of drawing past the track", () => {
        expect(freshnessFill(10, 20)).toBe(0.5);
        expect(freshnessFill(20, 20)).toBe(1);
        expect(freshnessFill(60, 20)).toBe(1);
        expect(freshnessFill(-5, 20)).toBe(0);
    });
});

/**
 * Pins the decision, not the value: the budget is a server-side tunable
 * (`DELIVERY_MAX_MINUTES_AFTER_READY`, shipped default 20) that no endpoint this client can reach
 * serialises. A hardcoded copy would be wrong the first time it is tuned, silently and in the
 * reassuring direction, so the client renders the figure with no verdict until the server sends
 * the budget. Change this line — and this test — in the same commit that starts sending it.
 */
describe("FRESHNESS_BUDGET_MINUTES", () => {
    it("is not a guess at the server's own tunable", () => {
        expect(FRESHNESS_BUDGET_MINUTES).toBeNull();
    });
});
