import { describe, it, expect, jest } from "@jest/globals";
import { render, screen, fireEvent } from "@testing-library/react";
// i18n instance (side-effect import) so keys resolve to English under the default language.
import "../../../shared/i18n";
import { ActiveOrderIslandPill } from "./ActiveOrderIslandPill";
import { MAX_RIDE_FILL } from "../../../shared/utils/orderStages";
import type { RideProgress } from "../../../shared/utils/orderStages";

type PillOverrides = {
    branchName?: string;
    orderNumber?: number;
    status?: string | null;
    orderType?: string;
    timeLeft?: number;
    arrivalTimeLeft?: number | null;
    rideProgress?: RideProgress | null;
    onClick?: () => void;
};

function renderPill(overrides: PillOverrides = {}): void {
    render(
        <ActiveOrderIslandPill
            branchName={overrides.branchName ?? "Downtown"}
            orderNumber={overrides.orderNumber ?? 7}
            status={overrides.status === undefined ? "Kitchen Phase" : overrides.status}
            orderType={overrides.orderType ?? "Pick Up"}
            timeLeft={overrides.timeLeft ?? 300}
            arrivalTimeLeft={overrides.arrivalTimeLeft ?? null}
            rideProgress={overrides.rideProgress ?? null}
            onClick={overrides.onClick ?? ((): void => undefined)}
        />
    );
}

/** The rendered fill, as a share of the whole track (0..1). */
function fillFraction(): number {
    const attr = screen.getByTestId("island-track-fill").getAttribute("data-fill-pct");
    return Number(attr) / 100;
}

describe("ActiveOrderIslandPill", () => {
    it("renders the branch name and order number", () => {
        renderPill({ orderNumber: 42 });

        expect(screen.getByText("Downtown")).toBeTruthy();
        expect(screen.getByText("Order #42")).toBeTruthy();
    });

    it("shows the ETA in minutes while preparing", () => {
        renderPill({ status: "Oven", timeLeft: 300 });

        // 300s -> ceil to 5 min
        expect(screen.getByText("5 min")).toBeTruthy();
    });

    // Asserts the current customerAuth `island.ready` copy. It was rewritten from "Ready!" to a
    // call to action, and this assertion was left behind -- the component was never wrong.
    it("shows the pick-up call to action instead of an ETA when the order is ready", () => {
        renderPill({ status: "Ready", timeLeft: 0 });

        expect(screen.getByText("Come In And Pick Up Your Order!")).toBeTruthy();
        // The "Estimated Ready in" caption and the branch name both give way to it.
        expect(screen.queryByText("Estimated Ready in")).toBeNull();
    });

    it("calls onClick when clicked", () => {
        const onClick = jest.fn<void, []>();
        renderPill({ timeLeft: 60, arrivalTimeLeft: null, onClick });

        fireEvent.click(screen.getByTestId("active-order-island-pill"));

        expect(onClick).toHaveBeenCalledTimes(1);
    });

    describe("delivery ladder", () => {
        it("draws five stages for a delivery order and ends the track at Delivered", () => {
            renderPill({ orderType: "Delivery", status: "Ready" });

            expect(screen.getByTestId("active-order-island-pill").getAttribute("data-order-type"))
                .toBe("delivery");
            expect(screen.getByText("Delivered")).toBeTruthy();
        });

        it("keeps a pickup order's track ending at Ready", () => {
            renderPill({ orderType: "Pick Up", status: "Ready" });

            expect(screen.queryByText("Delivered")).toBeNull();
            expect(screen.getByText("Ready")).toBeTruthy();
        });

        // The whole point of the ladder change: Ready is 2-of-4 on a delivery, not the end.
        it("leaves the track unfinished at Ready on a delivery order", () => {
            renderPill({ orderType: "Delivery", status: "Ready" });

            expect(fillFraction()).toBeCloseTo(0.5, 6);
        });

        it("fills a pickup order's track completely at Ready", () => {
            renderPill({ orderType: "Pick Up", status: "Ready" });

            expect(fillFraction()).toBeCloseTo(1, 6);
        });

        it("says the order is waiting for a courier at Ready, not to come and collect it", () => {
            renderPill({ orderType: "Delivery", status: "Ready", timeLeft: 0 });

            expect(screen.getByText("Ready, waiting for a courier")).toBeTruthy();
            expect(screen.queryByText("Come In And Pick Up Your Order!")).toBeNull();
        });
    });

    describe("the ride", () => {
        const ONE_THIRD: RideProgress = { fraction: 0.3, minutesLeft: 6, overdue: false };

        it("advances the fill inside the ride's own segment as time elapses", () => {
            const { unmount } = render(
                <ActiveOrderIslandPill
                    branchName="Downtown" orderNumber={7} status="Out for delivery"
                    orderType="Delivery" timeLeft={0}
        arrivalTimeLeft={null}
                    rideProgress={{ fraction: 0, minutesLeft: 12, overdue: false }}
                    onClick={(): void => undefined}
                />
            );
            const atStart = fillFraction();
            unmount();

            renderPill({ orderType: "Delivery", status: "Out for delivery", rideProgress: ONE_THIRD });
            const later = fillFraction();

            // Segment 4 of 4 runs from 0.75 to 1.0 of the track.
            expect(atStart).toBeCloseTo(0.75, 6);
            expect(later).toBeCloseTo(0.75 + 0.3 * 0.25, 6);
            expect(later).toBeGreaterThan(atStart);
        });

        it("counts down to the door rather than to the kitchen's ready time", () => {
            renderPill({
                orderType: "Delivery",
                status: "Out for delivery",
                // A stale, still-positive countdown to Ready that must NOT be what is shown.
                timeLeft: 9999, arrivalTimeLeft: null,
                rideProgress: ONE_THIRD,
            });

            expect(screen.getByText("Estimated Arrival in")).toBeTruthy();
            expect(screen.getByText("6 min")).toBeTruthy();
        });

        it("swaps the marker for the courier while the ride is on", () => {
            renderPill({ orderType: "Delivery", status: "Out for delivery", rideProgress: ONE_THIRD });

            expect(screen.getByTestId("island-marker-courier")).toBeTruthy();
        });

        // Overrun contract: stop short and say so, rather than sit at 100% claiming arrival.
        it("stops short of the Delivered node and drops the minute count when the ride runs long", () => {
            renderPill({
                orderType: "Delivery",
                status: "Out for delivery",
                rideProgress: { fraction: MAX_RIDE_FILL, minutesLeft: 0, overdue: true },
            });

            expect(fillFraction()).toBeLessThan(1);
            expect(fillFraction()).toBeCloseTo(0.75 + MAX_RIDE_FILL * 0.25, 6);
            expect(screen.getByText("Arriving any moment")).toBeTruthy();
            expect(screen.queryByText("0 min")).toBeNull();
        });

        // No ETA at all: movement without a quantity, and explicitly not a 0%-filled segment.
        it("sweeps the segment and names the state when there is no arrival estimate", () => {
            renderPill({ orderType: "Delivery", status: "Out for delivery", rideProgress: null });

            expect(screen.getByTestId("island-ride-indeterminate")).toBeTruthy();
            expect(screen.getByText("On the way")).toBeTruthy();
            expect(fillFraction()).toBeCloseTo(0.75, 6);
        });

        it("shows no sweep once a real estimate is available", () => {
            renderPill({ orderType: "Delivery", status: "Out for delivery", rideProgress: ONE_THIRD });

            expect(screen.queryByTestId("island-ride-indeterminate")).toBeNull();
        });
    });
});

/**
 * What a delivery customer is actually waiting for.
 *
 * The pill quoted "Estimated Ready in" and counted down to the KITCHEN for every order. For a
 * pickup that is exactly right — the customer is coming to the counter. For a delivery it counted
 * to zero while the food had not left the branch, and the caption then said "ready", which was
 * true of the pizza and useless to the person waiting at a door twenty minutes away.
 *
 * The arrival estimate is the midpoint of the window quoted at checkout ("arriving in 25-35 min"),
 * so the pill and the promise the customer agreed to are the same number rather than two.
 */
describe("ActiveOrderIslandPill — a delivery counts to the door", () => {
    it("counts down to the arrival, not to the kitchen", () => {
        renderPill({
            orderType: "Delivery",
            status: "Kitchen Phase",
            timeLeft: 300,
            arrivalTimeLeft: 1800,
        });

        expect(screen.getByText("30 min")).toBeTruthy();
        expect(screen.queryByText("5 min")).toBeNull();
    });

    it("names what the figure is counting to", () => {
        renderPill({
            orderType: "Delivery",
            status: "Kitchen Phase",
            timeLeft: 300,
            arrivalTimeLeft: 1800,
        });

        expect(screen.getByText("Estimated Delivered in")).toBeTruthy();
        expect(screen.queryByText("Estimated Ready in")).toBeNull();
    });

    /** A pickup customer IS waiting for the kitchen, and must keep counting to it. */
    it("leaves a pickup order counting to the kitchen", () => {
        renderPill({
            orderType: "Pick Up",
            status: "Kitchen Phase",
            timeLeft: 300,
            arrivalTimeLeft: 1800,
        });

        expect(screen.getByText("5 min")).toBeTruthy();
        expect(screen.getByText("Estimated Ready in")).toBeTruthy();
    });

    /**
     * No arrival estimate is a real state — an address the backend could not place, or a branch
     * with no coordinates. The kitchen countdown is then the best available answer, and inventing
     * an arrival would be worse than quoting the wrong leg.
     */
    it("falls back to the kitchen countdown when there is no arrival estimate", () => {
        renderPill({
            orderType: "Delivery",
            status: "Kitchen Phase",
            timeLeft: 300,
            arrivalTimeLeft: null,
        });

        expect(screen.getByText("5 min")).toBeTruthy();
        expect(screen.getByText("Estimated Ready in")).toBeTruthy();
    });
});
