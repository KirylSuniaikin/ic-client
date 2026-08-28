import { jest, describe, it, expect } from "@jest/globals";
import { render, screen } from "@testing-library/react";
// i18n instance (side-effect import) so keys resolve to English under the default language.
import "../../../shared/i18n";

// lottie-web tries to obtain a real 2D canvas context at import time, which jsdom does not
// provide -- stub the package so the unconditional Lottie import does not crash the suite.
jest.mock("lottie-react", () => ({
    __esModule: true,
    default: (): null => null,
}));

import { OrderStatusContent } from "./OrderStatusContent";
import type { OrderStatusData } from "../types";

function order(overrides: Partial<OrderStatusData> = {}): OrderStatusData {
    return {
        id: 1,
        orderNumber: 42,
        orderStatus: "Kitchen Phase",
        orderCreated: "2026-07-01 12:00",
        estimationTime: 30,
        branchId: "branch-1",
        orderType: "Pick Up",
        ...overrides,
    };
}

function reachedStages(): number {
    return screen.getAllByTestId(/^order-stage-\d+$/)
        .filter((node) => node.getAttribute("data-reached") === "true").length;
}

describe("OrderStatusContent", () => {
    it("keeps the pickup copy and the three-step ladder for a pickup order", () => {
        render(<OrderStatusContent order={order({ orderStatus: "Ready" })} remainingSeconds={0} />);

        expect(screen.getByText(/Your order is ready for pickup!/)).toBeTruthy();
        expect(screen.getAllByTestId(/^order-stage-\d+$/)).toHaveLength(3);
        expect(reachedStages()).toBe(3);
    });

    it("gives a delivery order the five-step ladder", () => {
        render(<OrderStatusContent order={order({ orderType: "Delivery", orderStatus: "Ready" })} remainingSeconds={0} />);

        expect(screen.getAllByTestId(/^order-stage-\d+$/)).toHaveLength(5);
        // Ready is a waypoint on a delivery, so two steps are still ahead.
        expect(reachedStages()).toBe(3);
    });

    it("tells a delivery customer the order is waiting for a courier, not to come and collect", () => {
        render(<OrderStatusContent order={order({ orderType: "Delivery", orderStatus: "Ready" })} remainingSeconds={0} />);

        expect(screen.getByText("Your order is ready and waiting for a courier 🛵")).toBeTruthy();
        expect(screen.queryByText(/Come in and grab it/)).toBeNull();
    });

    describe("Out for delivery", () => {
        const riding = order({
            orderType: "Delivery",
            orderStatus: "Out for delivery",
            handoverAt: "2026-07-01T12:25:00",
            estimatedDeliveredAt: "2026-07-01T12:47:00",
        });

        it("gives the ride its own treatment instead of falling through every status", () => {
            render(<OrderStatusContent order={riding} remainingSeconds={0} />);

            expect(screen.getByText("Your order is on the way 🛵")).toBeTruthy();
            expect(screen.getByTestId("delivery-ride-animation")).toBeTruthy();
            expect(reachedStages()).toBe(4);
        });

        it("shows the expected arrival as a Bahrain wall clock", () => {
            render(<OrderStatusContent order={riding} remainingSeconds={0} />);

            expect(screen.getByTestId("ride-arrival-line").textContent).toBe("Arriving around 12:47");
        });

        it("says the arrival is not known yet rather than inventing one", () => {
            render(<OrderStatusContent
                order={order({ orderType: "Delivery", orderStatus: "Out for delivery" })}
                remainingSeconds={0} />);

            expect(screen.getByTestId("ride-arrival-line").textContent)
                .toBe("We'll have an arrival time as soon as a courier picks it up.");
        });

        // The countdown is to Ready. Past Ready it is stale, so it must not be on screen at all.
        it("drops the ready countdown once the ride has started", () => {
            render(<OrderStatusContent order={riding} remainingSeconds={600} />);

            expect(screen.queryByText(/Will be ready in/)).toBeNull();
        });
    });

    it("closes the ladder on a delivered order", () => {
        render(<OrderStatusContent
            order={order({ orderType: "Delivery", orderStatus: "Delivered" })}
            remainingSeconds={0} />);

        expect(screen.getByText("Delivered — enjoy! 🍕")).toBeTruthy();
        expect(reachedStages()).toBe(5);
    });

    it("still counts down to ready before the kitchen is done", () => {
        render(<OrderStatusContent order={order({ orderType: "Delivery" })} remainingSeconds={125} />);

        expect(screen.getByText(/Will be ready in/)).toBeTruthy();
        expect(screen.getByText(/2:05/)).toBeTruthy();
    });
});
