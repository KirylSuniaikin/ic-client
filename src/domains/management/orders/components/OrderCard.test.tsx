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
import { markHandedOverToCourier, markPartHandedOverToCourier } from "../../../../shared/api/dispatcher";
import OrderCard from "./OrderCard";

const mockMarkHandedOverToCourier = jest.mocked(markHandedOverToCourier);
const mockMarkPartHandedOverToCourier = jest.mocked(markPartHandedOverToCourier);

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

/**
 * Courier-capacity Phase 5 (task-spec.md §11 P4): the kitchen card's per-part surface. D2 (one
 * button per part, side by side, not a single cycling button), D3 (the fixed notice while any
 * part still lacks a courier), and the "Part k/N" item label. A non-split order (no `parts`, or
 * `partsTotal` absent/1) must render exactly as {@code OrderCard — HANDED TO COURIER} already
 * proves — none of these tests touch that path.
 */
describe("OrderCard — split order hand-over (courier-capacity Phase 5)", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockMarkPartHandedOverToCourier.mockResolvedValue(undefined);
    });

    function makeSplitDelivery(overrides: Partial<Order> = {}): Order {
        return makeOrder({
            status: "Out for delivery",
            order_type: "Delivery",
            partsTotal: 2,
            parts: [
                { partId: 501, partIndex: 1, handedOver: true },
                { partId: 502, partIndex: 2, handedOver: false },
            ],
            courier_assigned: true,
            ...overrides,
        });
    }

    it("renders one hand-over button per part, side by side, not a single cycling button", () => {
        renderCard(makeSplitDelivery());

        expect(screen.getByText(/HAND OVER PART 2\/2/)).toBeTruthy();
        expect(screen.getByText(/PART 1\/2 HANDED OVER/)).toBeTruthy();
        // Never the single order-level button on a genuinely split order.
        expect(screen.queryByText("HANDED TO COURIER")).toBeNull();
        expect(screen.queryByText("NO COURIER YET")).toBeNull();
    });

    it("disables the already-handed-over part's own button", () => {
        renderCard(makeSplitDelivery());

        const doneButton = screen.getByText(/PART 1\/2 HANDED OVER/).closest("button");
        expect(doneButton?.disabled).toBe(true);
    });

    it("enables the still-open part's button once every part has a courier", () => {
        renderCard(makeSplitDelivery({ courier_assigned: true }));

        const openButton = screen.getByText(/HAND OVER PART 2\/2/).closest("button");
        expect(openButton?.disabled).toBe(false);
    });

    /** D3: the fixed notice, and the backend's own 409 gate mirrored client-side as a disabled button. */
    it("shows the D3 notice and disables every open part's button while courier_assigned is not true", () => {
        renderCard(makeSplitDelivery({ courier_assigned: false }));

        expect(screen.getByText(
            "Every part needs its own courier before any of them can be handed over."
        )).toBeTruthy();
        const openButton = screen.getByText(/HAND OVER PART 2\/2/).closest("button");
        expect(openButton?.disabled).toBe(true);
    });

    it("shows no D3 notice once every part has a courier", () => {
        renderCard(makeSplitDelivery({ courier_assigned: true }));

        expect(screen.queryByText(
            "Every part needs its own courier before any of them can be handed over."
        )).toBeNull();
    });

    it("posts the hand-over for the specific part that was tapped, not the order", async () => {
        renderCard(makeSplitDelivery());

        fireEvent.click(screen.getByText(/HAND OVER PART 2\/2/));
        fireEvent.click(screen.getByText("Confirm"));

        await waitFor(() => expect(mockMarkPartHandedOverToCourier).toHaveBeenCalledWith(502));
        expect(mockMarkHandedOverToCourier).not.toHaveBeenCalled();
    });

    it("renders 'Part k/N' on each item only when the order is genuinely split", () => {
        renderCard(makeSplitDelivery({
            items: [
                { name: "Pepperoni", category: "Pizzas", size: "L", quantity: 1, amount: 5, description: "", partIndex: 1 },
                { name: "Cola", category: "Beverages", size: "", quantity: 2, amount: 2, description: "", partIndex: 2 },
            ],
        }));

        expect(screen.getByText("Part 1/2")).toBeTruthy();
        expect(screen.getByText("Part 2/2")).toBeTruthy();
    });

    it("renders 'Part k/N: q of Q' once per share for a line cut across parts", () => {
        renderCard(makeSplitDelivery({
            items: [
                {
                    name: "Margherita", category: "Pizzas", size: "L", quantity: 5, amount: 25, description: "",
                    partShares: [{partIndex: 1, quantity: 3}, {partIndex: 2, quantity: 2}],
                },
            ],
        }));

        expect(screen.getByText("Part 1/2: 3 of 5")).toBeTruthy();
        expect(screen.getByText("Part 2/2: 2 of 5")).toBeTruthy();
        expect(screen.queryByText("Part 1/2")).toBeNull();
    });

    it("keeps a plain 'Part k/N' for an uncut line that carries a single share", () => {
        renderCard(makeSplitDelivery({
            items: [
                {
                    name: "Cola", category: "Beverages", size: "", quantity: 2, amount: 2, description: "",
                    partIndex: 2, partShares: [{partIndex: 2, quantity: 2}],
                },
            ],
        }));

        expect(screen.getByText("Part 2/2")).toBeTruthy();
        expect(screen.queryByText(/ of /)).toBeNull();
    });

    it("renders no 'Part k/N' label at all on a non-split order's items", () => {
        renderCard(makeReadyDelivery({
            items: [
                { name: "Pepperoni", category: "Pizzas", size: "L", quantity: 1, amount: 5, description: "" },
            ],
        }));

        expect(screen.queryByText(/Part \d+\/\d+/)).toBeNull();
    });

    /** A non-split order's card/button set must be byte-identical — proven again here for D8/§12. */
    it("leaves a non-split delivery order's single hand-over button completely unaffected", () => {
        renderCard(makeReadyDelivery());

        expect(screen.getByText("HANDED TO COURIER")).toBeTruthy();
        expect(screen.queryByText(/HAND OVER PART/)).toBeNull();
        expect(screen.queryByText(
            "Every part needs its own courier before any of them can be handed over."
        )).toBeNull();
    });

    /**
     * Review iteration 1, Issue 1: a `Cancelled` split order with an undeparted sibling part used
     * to still present an enabled hand-over control — the block had no status check at all, so a
     * terminal order could resurrect itself as "Out for delivery" if a stray tap landed. The board's
     * own `findActiveOrders` rescue is narrowed server-side too, but this card must not trust that
     * alone: it never renders a hand-over control at all once the order is no longer "Ready" or
     * "Out for delivery".
     */
    it("renders no split hand-over control at all once the order is Cancelled", () => {
        renderCard(makeSplitDelivery({ status: "Cancelled" }));

        expect(screen.queryByText(/HAND OVER PART/)).toBeNull();
        expect(screen.queryByText(/PART \d+\/\d+ HANDED OVER/)).toBeNull();
        expect(screen.queryByText(
            "Every part needs its own courier before any of them can be handed over."
        )).toBeNull();
    });

    it("renders no split hand-over control at all once the order is Returned Undelivered", () => {
        renderCard(makeSplitDelivery({ status: "Returned Undelivered" }));

        expect(screen.queryByText(/HAND OVER PART/)).toBeNull();
        expect(screen.queryByText(/PART \d+\/\d+ HANDED OVER/)).toBeNull();
    });

    /**
     * Review iteration 1, Issue 2: `parts[k].handedOver` only ever arrives via the REST snapshot —
     * no live frame carries it — so without a local override a successfully handed-over part's own
     * button reverted to its enabled label the instant the request resolved, misstating which parts
     * were actually done for the rest of the card's now-extended lifetime. Three parts here (rather
     * than two) so the block stays on screen after the tapped part is done — part 3 is still open —
     * and the flip is observable rather than hidden behind the whole block's own disappearance.
     */
    it("flips the tapped part's own button to the handed-over/disabled form once the API call resolves", async () => {
        renderCard(makeSplitDelivery({
            partsTotal: 3,
            parts: [
                { partId: 501, partIndex: 1, handedOver: true },
                { partId: 502, partIndex: 2, handedOver: false },
                { partId: 503, partIndex: 3, handedOver: false },
            ],
        }));

        fireEvent.click(screen.getByText(/HAND OVER PART 2\/3/));
        fireEvent.click(screen.getByText("Confirm"));

        await waitFor(() => expect(mockMarkPartHandedOverToCourier).toHaveBeenCalledWith(502));
        await waitFor(() => expect(screen.getByText(/PART 2\/3 HANDED OVER/)).toBeTruthy());
        const doneButton = screen.getByText(/PART 2\/3 HANDED OVER/).closest("button");
        expect(doneButton?.disabled).toBe(true);
        // Part 1's own state is untouched by part 2's hand-over, and part 3 is still open.
        expect(screen.getByText(/PART 1\/3 HANDED OVER/)).toBeTruthy();
        expect(screen.getByText(/HAND OVER PART 3\/3/)).toBeTruthy();
    });

    it("does not flip the tapped part's button when the hand-over call fails", async () => {
        mockMarkPartHandedOverToCourier.mockRejectedValueOnce(new Error("network down"));
        renderCard(makeSplitDelivery({
            partsTotal: 3,
            parts: [
                { partId: 501, partIndex: 1, handedOver: true },
                { partId: 502, partIndex: 2, handedOver: false },
                { partId: 503, partIndex: 3, handedOver: false },
            ],
        }));

        fireEvent.click(screen.getByText(/HAND OVER PART 2\/3/));
        fireEvent.click(screen.getByText("Confirm"));

        await waitFor(() => expect(mockMarkPartHandedOverToCourier).toHaveBeenCalledWith(502));
        expect(screen.getByText(/HAND OVER PART 2\/3/)).toBeTruthy();
        expect(screen.queryByText(/PART 2\/3 HANDED OVER/)).toBeNull();
    });
});

/**
 * T7 (owner decision Q5-1): each split part's button names its assigned rider, the confirm
 * repeats the name and sends it, and a stale name (409) tells the board to refresh that order.
 */
describe("OrderCard — split order names the rider (T7)", () => {
    const onPartHandOverConflict = jest.fn<void, [string]>();

    beforeEach(() => {
        jest.clearAllMocks();
        mockMarkPartHandedOverToCourier.mockResolvedValue(undefined);
    });

    function renderNamed(order: Order): void {
        render(
            <MemoryRouter>
                <OrderCard order={order} onDeleteClick={jest.fn()} onPartHandOverConflict={onPartHandOverConflict} />
            </MemoryRouter>
        );
    }

    function makeNamedSplit(): Order {
        return makeOrder({
            id: "1234",
            status: "Ready",
            order_type: "Delivery",
            partsTotal: 2,
            parts: [
                { partId: 501, partIndex: 1, handedOver: true, courierName: "Ali" },
                { partId: 502, partIndex: 2, handedOver: false, courierName: "Sara" },
            ],
            courier_assigned: true,
        });
    }

    it("appends the rider's name to each part's label, handed-over or not", () => {
        renderNamed(makeNamedSplit());

        expect(screen.getByText("HAND OVER PART 2/2 · Sara")).toBeTruthy();
        expect(screen.getByText("PART 1/2 HANDED OVER · Ali")).toBeTruthy();
    });

    it("renders today's label for a part with no courierName", () => {
        renderNamed(makeOrder({
            status: "Ready",
            order_type: "Delivery",
            partsTotal: 2,
            parts: [
                { partId: 501, partIndex: 1, handedOver: false, courierName: null },
                { partId: 502, partIndex: 2, handedOver: false },
            ],
            courier_assigned: false,
        }));

        expect(screen.getByText("HAND OVER PART 1/2")).toBeTruthy();
        expect(screen.getByText("HAND OVER PART 2/2")).toBeTruthy();
    });

    it("names the rider in the confirm dialog", () => {
        renderNamed(makeNamedSplit());

        fireEvent.click(screen.getByText("HAND OVER PART 2/2 · Sara"));

        expect(screen.getByText(/part 2 of 2 of order #\d+ has\s+been handed to Sara\./)).toBeTruthy();
    });

    it("confirms with the tapped part's id and its rider's name", async () => {
        renderNamed(makeNamedSplit());

        fireEvent.click(screen.getByText("HAND OVER PART 2/2 · Sara"));
        fireEvent.click(screen.getByText("Confirm"));

        await waitFor(() => expect(mockMarkPartHandedOverToCourier).toHaveBeenCalledWith(502, "Sara"));
    });

    it("sends no name when the tapped part has none", async () => {
        renderNamed(makeOrder({
            status: "Ready",
            order_type: "Delivery",
            partsTotal: 2,
            parts: [
                { partId: 501, partIndex: 1, handedOver: false },
                { partId: 502, partIndex: 2, handedOver: false },
            ],
            courier_assigned: true,
        }));

        fireEvent.click(screen.getByText("HAND OVER PART 1/2"));
        fireEvent.click(screen.getByText("Confirm"));

        await waitFor(() => expect(mockMarkPartHandedOverToCourier).toHaveBeenCalledTimes(1));
        expect(mockMarkPartHandedOverToCourier.mock.calls[0]).toEqual([501]);
    });

    it("keeps a single-part order at one tap: single button, no rider name, no name argument", async () => {
        mockMarkHandedOverToCourier.mockResolvedValue(undefined);
        renderNamed(makeReadyDelivery({ id: "77", partsTotal: 1, courier_assigned: true }));

        expect(screen.getByText("HANDED TO COURIER")).toBeTruthy();
        expect(screen.queryByText(/ · /)).toBeNull();
        fireEvent.click(screen.getByText("HANDED TO COURIER"));
        fireEvent.click(screen.getByText("Confirm"));

        await waitFor(() => expect(mockMarkHandedOverToCourier).toHaveBeenCalledWith(77));
        expect(mockMarkPartHandedOverToCourier).not.toHaveBeenCalled();
    });

    it("shows the split-specific message and asks the board to refresh once on a 409", async () => {
        mockMarkPartHandedOverToCourier.mockRejectedValue(new DeliveryApiError("Response: 409", 409));
        renderNamed(makeNamedSplit());

        fireEvent.click(screen.getByText("HAND OVER PART 2/2 · Sara"));
        fireEvent.click(screen.getByText("Confirm"));

        expect(await screen.findByText(/This part's rider has changed or another part is still unassigned/)).toBeTruthy();
        expect(screen.queryByText(/No courier is assigned to this order yet/)).toBeNull();
        expect(onPartHandOverConflict).toHaveBeenCalledTimes(1);
        expect(onPartHandOverConflict).toHaveBeenCalledWith("1234");
    });

    it("does not ask for a refresh on a non-409 failure", async () => {
        mockMarkPartHandedOverToCourier.mockRejectedValue(new DeliveryApiError("Response: 500", 500));
        renderNamed(makeNamedSplit());

        fireEvent.click(screen.getByText("HAND OVER PART 2/2 · Sara"));
        fireEvent.click(screen.getByText("Confirm"));

        expect(await screen.findByText(/Hand-over failed\. Response: 500/)).toBeTruthy();
        expect(onPartHandOverConflict).not.toHaveBeenCalled();
    });
});
