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
 * The card is a kitchen document on a wall. It says HOW the order leaves — the one fulfilment
 * fact the kitchen acts on, because it decides who the bag is handed to — and it says nothing
 * about where it goes: the address is the courier's business and it is customer data on a screen
 * a room full of people can read. The dispatcher board (domains/management/couriers) is where the
 * address is wanted, and it renders its own cards from its own components, so it is untouched.
 *
 * Every test here that asserts an ABSENCE also asserts that the rest of the card is still on
 * screen — otherwise a component that rendered nothing at all would pass them all.
 */
describe("OrderCard — how a delivery order reads", () => {
    // The guard against a blank render: these three are the card's spine and are asserted
    // alongside every absence below.
    function expectTheCardIsStillHere(): void {
        expect(screen.getByText("#4821")).toBeTruthy();
        expect(screen.getByText(/Test Customer/)).toBeTruthy();
        expect(screen.getByText("OVEN")).toBeTruthy();
    }

    // Label and value are asserted together, on one node: a card printing "Type:" beside somebody
    // else's value, or "Delivery" under the wrong label, is not what was asked for.
    it("prints the fulfilment type as a detail row, label and value together", () => {
        renderCard(makeOrder({ order_type: "Delivery" }));

        const row = screen.getByText("Type:").closest("p");
        expect(row?.textContent).toBe("Type: Delivery");
    });

    it("says nothing about fulfilment on a pick-up order", () => {
        renderCard(makeOrder({ order_type: "Pick Up" }));

        expect(screen.queryByText("Type:")).toBeNull();
        expectTheCardIsStillHere();
    });

    /**
     * The status badge that used to sit in the header row, in both of its states. It was the one
     * thing along the top of the card that carried a status, and the kitchen never used either
     * half of it — the fulfilment row below carries the only part it acts on.
     */
    it("carries no status badge along the top of the card", () => {
        renderCard(makeOrder({ order_type: "Delivery", courier_at_kitchen: true }));

        expect(screen.queryByText("DELIVERY")).toBeNull();
        expect(screen.queryByText("COURIER HERE")).toBeNull();
        expectTheCardIsStillHere();
    });

    it("never prints the customer's address, even when the order carries one", () => {
        renderCard(makeOrder({
            order_type: "Delivery",
            address: "Block 338, Road 1707, Building 42",
        }));

        expect(screen.queryByText("Deliver to:")).toBeNull();
        expect(screen.queryByText(/Block 338/)).toBeNull();
        expectTheCardIsStillHere();
    });

    // The customer line is not the address line and was never part of this removal: the kitchen
    // still has to know whose order it is holding.
    it("keeps the customer details the card already showed", () => {
        renderCard(makeOrder({ order_type: "Delivery", customer_name: "Layla", phone_number: "97312345678" }));

        expect(screen.getByText(/Layla/)).toBeTruthy();
        expect(screen.getByText(/97312345678/)).toBeTruthy();
    });

    // History shares this component with the live board, so the same two rules hold there.
    it("reads the same way in the history view", () => {
        render(
            <MemoryRouter>
                <OrderCard
                    order={makeOrder({ order_type: "Delivery", address: "Block 338", courier_at_kitchen: true })}
                    onDeleteClick={jest.fn()}
                    isHistory
                />
            </MemoryRouter>
        );

        expect(screen.getByText("Type:").closest("p")?.textContent).toBe("Type: Delivery");
        expect(screen.queryByText("Deliver to:")).toBeNull();
        expect(screen.queryByText("DELIVERY")).toBeNull();
        // The card is still a card: history's own rows are untouched.
        expect(screen.getByText("#4821")).toBeTruthy();
        expect(screen.getByText("Payment type:")).toBeTruthy();
    });
});

/**
 * The rider's arrival used to be a badge in the header. The badge is gone, but the decision it was
 * built around is not: the hand-over button is gated on `courier_assigned` alone, and an arrival
 * must not touch it. Two controls disagreeing about one rider is what the earlier caption cost.
 */
describe("OrderCard — a rider arriving changes nothing on the card", () => {
    it("leaves the hand-over button's own label untouched", () => {
        renderCard(makeReadyDelivery({ courier_assigned: true, courier_at_kitchen: true }));

        const button = screen.getByText("HANDED TO COURIER").closest("button");
        expect(button?.textContent).toBe("HANDED TO COURIER");
        expect(screen.queryByText("NO COURIER YET")).toBeNull();
        expect(button?.disabled).toBe(false);
    });

    // The flag is still on the order and still reaches the dispatcher board; it simply has no
    // rendering of its own here any more.
    it("adds nothing to a kitchen-phase card when the rider is at the pass", () => {
        renderCard(makeOrder({
            status: "Kitchen Phase",
            order_type: "Delivery",
            courier_at_kitchen: true,
        }));

        expect(screen.queryByText("COURIER HERE")).toBeNull();
        expect(screen.getByText("Type:").closest("p")?.textContent).toBe("Type: Delivery");
        expect(screen.getByText("OVEN")).toBeTruthy();
    });
});
