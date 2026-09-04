import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Order } from "../../../order/types";
import { DeliveryApiError } from "../../../delivery/types";

// lottie-web obtains a real 2D canvas context at import time, which jsdom does not provide.
jest.mock("lottie-react", () => ({
    __esModule: true,
    default: (): null => null,
}));

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/public.ts
jest.mock("../../../../shared/api/public");
// Factoryless again (this repo's Jest Mock Factory Pattern: `jest` is a local import from
// @jest/globals, so a factory referencing jest.fn() trips babel-plugin-jest-hoist). There is no
// manual mock for dispatcher.ts, so this is the automock; per-test behaviour is set through
// jest.mocked() below.
jest.mock("../../../../shared/api/dispatcher");

import * as publicApi from "../../../../shared/api/public";
import { markHandedOverToCourier } from "../../../../shared/api/dispatcher";
import OrderCard from "./OrderCard";

const mockMarkHandedOverToCourier = jest.mocked(markHandedOverToCourier);

// The shared public mock does not export these two (see HistoryComponent.test.tsx); OrderCard
// reaches for them at call time, so patching them onto the mocked module object is enough.
const mockDeleteOrder = jest.fn<Promise<void>, [string]>();
const mockUpdateOrderStatus = jest.fn<Promise<void>, [unknown]>();
(publicApi as unknown as { deleteOrder: unknown }).deleteOrder = mockDeleteOrder;
(publicApi as unknown as { updateOrderStatus: unknown }).updateOrderStatus = mockUpdateOrderStatus;

function makeOrder(overrides: Partial<Order> = {}): Order {
    return {
        id: "1",
        order_no: 4821,
        tel: "12345678",
        customer_name: "Test Customer",
        delivery_method: "Pick Up",
        payment_type: "Cash",
        address: "",
        notes: "",
        items: [],
        amount_paid: 10,
        order_type: "Pick Up",
        external_id: null,
        phone_number: "12345678",
        order_created: new Date().toISOString(),
        status: "Kitchen Phase",
        isPaid: false,
        branch_id: "branch-1",
        estimation: 15,
        ...overrides,
    };
}

function renderCard(order: Order): HTMLElement {
    const { container } = render(
        <MemoryRouter>
            <OrderCard order={order} onDeleteClick={jest.fn()} />
        </MemoryRouter>
    );
    // The MUI Card is the outermost element the background colour is applied to.
    return container.querySelector(".MuiCard-root") as HTMLElement;
}

function makeReadyDelivery(overrides: Partial<Order> = {}): Order {
    return makeOrder({
        status: "Ready",
        order_type: "Delivery",
        courier_assigned: true,
        courier_at_kitchen: true,
        ...overrides,
    });
}

// MUI applies the colour through an emotion class, not an inline style, so it has to be read
// from the computed style — which jsdom resolves to rgb() form.
function backgroundOf(card: HTMLElement): string {
    return window.getComputedStyle(card).backgroundColor;
}

describe("OrderCard — background colours", () => {
    it("renders an ordinary kitchen order white", () => {
        const card = renderCard(makeOrder({ status: "Kitchen Phase" }));

        expect(backgroundOf(card)).toBe("rgb(255, 255, 255)");
    });

    it.each([
        ["Jahez", "rgb(255, 245, 245)"],
        ["Keeta", "rgb(205, 186, 46)"],
        ["Talabat", "rgb(251, 170, 102)"],
    ] as const)("keeps the %s colour", (orderType, expected) => {
        // Regression guard for cardBackgroundColor(), which replaced an inline four-deep ternary.
        const card = renderCard(makeOrder({ order_type: orderType }));

        expect(backgroundOf(card)).toBe(expected);
    });

    it("still shows OVEN on a paid kitchen order", () => {
        renderCard(makeOrder({ status: "Kitchen Phase" }));

        expect(screen.getByText("OVEN")).toBeTruthy();
    });
});

/**
 * F2: "Picked Up" means the CUSTOMER collected the order. On a delivery order the food is
 * collected by the courier, and that transition is driven by the courier app — so staff must not
 * be able to fire it from the board. Pick-up orders are untouched.
 */
describe("OrderCard — PICKED UP on a delivery order", () => {
    it("hides PICKED UP on a ready delivery order", () => {
        renderCard(makeOrder({ status: "Ready", order_type: "Delivery" }));

        expect(screen.queryByText("PICKED UP")).toBeNull();
    });

    it("still offers PICKED UP on a ready pick-up order", () => {
        renderCard(makeOrder({ status: "Ready", order_type: "Pick Up" }));

        expect(screen.getByText("PICKED UP")).toBeTruthy();
    });

    it("leaves the earlier kitchen actions on a delivery order alone", () => {
        renderCard(makeOrder({ status: "Oven", order_type: "Delivery" }));

        expect(screen.getByText("READY")).toBeTruthy();
    });
});

/**
 * Requirement B: the kitchen, not the rider, confirms the hand-over. The two board-side flags
 * exist so the card can tell "ready to hand over" from "still waiting for a rider" before anyone
 * taps, and the 409 is still a live possibility because the board can go stale under the tap.
 */
describe("OrderCard — HANDED TO COURIER", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockMarkHandedOverToCourier.mockResolvedValue(undefined);
    });

    function handOver(): void {
        fireEvent.click(screen.getByText("HANDED TO COURIER"));
        fireEvent.click(screen.getByText("Confirm"));
    }

    it("offers the button on a ready delivery order with a courier assigned", () => {
        renderCard(makeReadyDelivery());

        expect(screen.getByText("HANDED TO COURIER")).toBeTruthy();
    });

    /**
     * The caption is gone. `courier_at_kitchen` never gated the button — the server back-fills
     * that timestamp on hand-over — so describing a rider who is already assigned bought nothing
     * on a card this dense, and one shared with pick-up orders.
     */
    it("spends no words describing a courier that is already assigned", () => {
        renderCard(makeReadyDelivery({ courier_at_kitchen: true }));

        expect(screen.queryByText("Courier is here")).toBeNull();
        expect(screen.queryByText("Courier on the way")).toBeNull();
        expect(screen.getByText("HANDED TO COURIER")).toBeTruthy();
    });

    it("keeps the hand-over live for a rider assigned but not yet at the pass", () => {
        renderCard(makeReadyDelivery({ courier_at_kitchen: false }));

        expect(screen.queryByText("Courier on the way")).toBeNull();
        const button = screen.getByText("HANDED TO COURIER").closest("button");
        expect(button?.disabled).toBe(false);
    });

    /**
     * The flag the endpoint 409s on. Staff are still told — but by the button itself, disabled and
     * relabelled in place, so the row keeps its height instead of carrying a caption of its own.
     */
    it("replaces the hand-over with a short disabled button when no courier is assigned", () => {
        renderCard(makeReadyDelivery({ courier_assigned: false, courier_at_kitchen: false }));

        expect(screen.queryByText("Waiting for a courier")).toBeNull();
        expect(screen.queryByText("HANDED TO COURIER")).toBeNull();

        const button = screen.getByText("NO COURIER YET").closest("button");
        expect(button?.disabled).toBe(true);
    });

    it("never offers it on a pick-up order — those still use PICKED UP", () => {
        renderCard(makeOrder({ status: "Ready", order_type: "Pick Up", courier_assigned: true }));

        expect(screen.queryByText("HANDED TO COURIER")).toBeNull();
        expect(screen.getByText("PICKED UP")).toBeTruthy();
    });

    it("never offers it in the history view", () => {
        render(
            <MemoryRouter>
                <OrderCard order={makeReadyDelivery()} onDeleteClick={jest.fn()} isHistory />
            </MemoryRouter>
        );

        expect(screen.queryByText("HANDED TO COURIER")).toBeNull();
    });

    it("posts the hand-over for the order that was tapped", async () => {
        renderCard(makeReadyDelivery({ id: "77" }));

        handOver();

        await waitFor(() => expect(mockMarkHandedOverToCourier).toHaveBeenCalledWith(77));
    });

    /**
     * The card is removed by the backend's `pushDeleted` frame. Removing it here as well would be
     * a second, competing mechanism that disagrees with the first whenever the frame is lost.
     */
    it("does not remove the card locally on success", async () => {
        const onPickedUpClick = jest.fn<void, [Order]>();
        render(
            <MemoryRouter>
                <OrderCard
                    order={makeReadyDelivery({ order_no: 4821 })}
                    onDeleteClick={jest.fn()}
                    onPickedUpClick={onPickedUpClick}
                />
            </MemoryRouter>
        );

        handOver();

        await waitFor(() => expect(mockMarkHandedOverToCourier).toHaveBeenCalled());
        expect(onPickedUpClick).not.toHaveBeenCalled();
        expect(mockUpdateOrderStatus).not.toHaveBeenCalled();
        // Still on screen: nothing but the STOMP frame may take it off.
        expect(screen.getByText("#4821")).toBeTruthy();
    });

    // The board can go stale between being drawn and being tapped — a rider gets released or
    // reassigned — so the 409 has to be surfaced, not swallowed.
    it("surfaces a 409 as a message instead of failing silently", async () => {
        mockMarkHandedOverToCourier.mockRejectedValue(new DeliveryApiError("Response: 409", 409));
        renderCard(makeReadyDelivery());

        handOver();

        const notice = await screen.findByText(
            "No courier is assigned to this order yet — hand it over once a rider has been assigned."
        );
        expect(notice).toBeTruthy();
    });

    /**
     * The other half of the branch. A 409 is an expected state with its own sentence; everything
     * else is a fault, and the kitchen has to be told which one it is — a tablet that silently
     * does nothing on a 500 gets the button pressed again and again while the rider waits.
     */
    it("says what went wrong when the hand-over fails for any other reason", async () => {
        mockMarkHandedOverToCourier.mockRejectedValue(new DeliveryApiError("Response: 500", 500));
        renderCard(makeReadyDelivery());

        handOver();

        expect(await screen.findByText(/Hand-over failed\. Response: 500/)).toBeTruthy();
        // …and not the 409 sentence, which would be a lie about what happened.
        expect(screen.queryByText(/No courier is assigned to this order yet/)).toBeNull();
    });
});

/**
 * The two things the owner asked the card for, both of which have to survive the constraint that
 * killed the previous attempt: the card is dense, it is shared with pick-up, and the caption that
 * said "courier is here" in prose was removed for taking a whole line.
 *
 * So the delivery identity and the rider's arrival share ONE badge in the header row — two states
 * of the same thing — and a pick-up card renders no badge at all.
 */
describe("OrderCard — a delivery order reads as one", () => {
    it("marks a delivery order DELIVERY", () => {
        renderCard(makeOrder({ order_type: "Delivery" }));

        expect(screen.getByText("DELIVERY")).toBeTruthy();
    });

    it("puts no badge on a pick-up order", () => {
        renderCard(makeOrder({ order_type: "Pick Up" }));

        expect(screen.queryByText("DELIVERY")).toBeNull();
        expect(screen.queryByText("COURIER HERE")).toBeNull();
    });

    it("shows the destination so the packer knows what they are packing for", () => {
        renderCard(makeOrder({ order_type: "Delivery", address: "Block 338, Road 1707, Building 42" }));

        expect(screen.getByText("Block 338, Road 1707, Building 42")).toBeTruthy();
    });

    // Every delivery order placed before the checkout denormalised the address carries a null one,
    // and a stray "Deliver to:" label with nothing after it is worse than no line.
    it("spends no line on a delivery order with no address recorded", () => {
        renderCard(makeOrder({ order_type: "Delivery", address: "" }));

        expect(screen.queryByText("Deliver to:")).toBeNull();
    });

    // The address is the delivery counterpart of the customer line, not a replacement for it.
    it("keeps the customer details a pick-up order already showed", () => {
        renderCard(makeOrder({ order_type: "Delivery", customer_name: "Layla", phone_number: "97312345678" }));

        expect(screen.getByText(/Layla/)).toBeTruthy();
        expect(screen.getByText(/97312345678/)).toBeTruthy();
    });

    // A pick-up order never carries the flag, but nothing stops a stale one arriving.
    it("never turns a pick-up card into a courier badge", () => {
        renderCard(makeOrder({ order_type: "Pick Up", courier_at_kitchen: true }));

        expect(screen.queryByText("COURIER HERE")).toBeNull();
    });
});

/**
 * Requirement A: the rider taps "I am at the kitchen" and, until now, nothing told the kitchen.
 * `courier_assigned` could not stand in for it — a rider can be assigned and still be ten minutes
 * away — so this is the fact the badge exists to carry.
 */
describe("OrderCard — the rider is at the pass", () => {
    it("switches the badge the moment the rider arrives", () => {
        renderCard(makeOrder({ order_type: "Delivery", courier_at_kitchen: true }));

        expect(screen.getByText("COURIER HERE")).toBeTruthy();
        expect(screen.queryByText("DELIVERY")).toBeNull();
    });

    // An assigned rider is not an arrived rider — that distinction is the whole point.
    it("still reads DELIVERY for a rider who is assigned but not here yet", () => {
        renderCard(makeOrder({
            order_type: "Delivery",
            courier_assigned: true,
            courier_at_kitchen: false,
        }));

        expect(screen.getByText("DELIVERY")).toBeTruthy();
        expect(screen.queryByText("COURIER HERE")).toBeNull();
    });

    // The signal exists from the moment the rider walks in, not only once the food is Ready —
    // which is exactly the window where the hand-over button does not yet exist to carry it.
    it("shows before the order is Ready, where no hand-over button exists to say it", () => {
        renderCard(makeOrder({
            status: "Kitchen Phase",
            order_type: "Delivery",
            courier_at_kitchen: true,
        }));

        expect(screen.getByText("COURIER HERE")).toBeTruthy();
        expect(screen.queryByText("HANDED TO COURIER")).toBeNull();
    });

    // A finished order's rider is long gone; arrival is a live-board fact.
    it("falls back to DELIVERY in the history view", () => {
        render(
            <MemoryRouter>
                <OrderCard
                    order={makeReadyDelivery({ courier_at_kitchen: true })}
                    onDeleteClick={jest.fn()}
                    isHistory
                />
            </MemoryRouter>
        );

        expect(screen.getByText("DELIVERY")).toBeTruthy();
        expect(screen.queryByText("COURIER HERE")).toBeNull();
    });

    /**
     * The documented decision the owner made when the caption was removed: the hand-over button's
     * label is gated on `courier_assigned` alone. The badge must carry the arrival WITHOUT
     * reopening that — two controls disagreeing about one rider is what the caption cost.
     */
    it("leaves the hand-over button's own label untouched", () => {
        renderCard(makeReadyDelivery({ courier_assigned: true, courier_at_kitchen: true }));

        const button = screen.getByText("HANDED TO COURIER").closest("button");
        // The label is what the title is about, so it is asserted rather than merely used as a
        // lookup: an arrival must not flip the button to "NO COURIER YET" or to a third wording.
        expect(button?.textContent).toBe("HANDED TO COURIER");
        expect(screen.queryByText("NO COURIER YET")).toBeNull();
        expect(button?.disabled).toBe(false);
    });
});
