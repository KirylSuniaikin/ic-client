import { jest, describe, it, expect, beforeEach, beforeAll } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor, act, within } from "@testing-library/react";
import { DeliveryBoardPanel } from "./DeliveryBoardPanel";
import type { DeliveryBoardPanelProps } from "./DeliveryBoardPanel";
import { fetchBoardCouriers, fetchDeliveryCards } from "../../../../shared/api/dispatcher";
import type { CourierBoardRow, CourierStats, DeliveryCard, UnassignedOrder } from "../types";
import { connectSocket, socket } from "../../../../shared/api/socket";
import { PANEL_MIN_HEIGHT, TONE_BAD, TONE_OK } from "./dispatcherStyles";
import { emotionRulesFor } from "./emotionRules.testutil";

jest.mock("../../../../shared/api/socket");
jest.mock("../../../../shared/api/dispatcher");

beforeAll(() => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
});

// jest.mocked, not a `jest.Mock` annotation: there is no @types/jest here, so the type form
// compiles under Babel and fails tsc — see ic-client/.claude/CLAUDE.md.
const mockCards = jest.mocked(fetchDeliveryCards);
const mockCouriers = jest.mocked(fetchBoardCouriers);
const mockConnectSocket = jest.mocked(connectSocket);
const mockSubscribe = jest.mocked(socket.subscribe);

/**
 * A naive Bahrain-local wall clock `minutesAgo` in the past — exactly the shape the backend sends
 * (a zoneless LocalDateTime). Built by shifting UTC forward three hours and taking the calendar
 * part, so the fixture is correct whatever zone the test machine is in.
 */
function bahrainLocal(minutesAgo: number): string {
    return new Date(Date.now() - minutesAgo * 60_000 + 3 * 60 * 60_000)
        .toISOString()
        .slice(0, 19);
}

/** orderNo and orderId deliberately differ: the endpoint is keyed by id, the card shows the no. */
const AT_RISK: DeliveryCard = {
    orderId: 101, orderNo: 11, status: "Out for delivery",
    branchId: "b1", branchName: "Manama", addressLine: "Block 338, Road 3801",
    customerPhone: "33110022", courierPhone: "39887766",
    readyAt: "2026-08-08T10:00:00", estimatedHandoverAt: "2026-08-08T10:05:00",
    estimatedDeliveredAt: "2026-08-08T10:48:00", riskMinutes: 48,
    freshnessBudgetMinutes: 20,
};

const CALM: DeliveryCard = {
    orderId: 102, orderNo: 12, status: "Kitchen Phase",
    branchId: "b1", branchName: "Manama", addressLine: "Block 12, Road 4",
    customerPhone: "33445566", courierPhone: null,
    readyAt: "2026-08-08T11:00:00", estimatedHandoverAt: "2026-08-08T11:02:00",
    estimatedDeliveredAt: "2026-08-08T11:06:00", riskMinutes: 6,
    freshnessBudgetMinutes: 20,
};

/** Nothing about this one is derivable yet — every timing came back null, not zero. */
const UNKNOWABLE: DeliveryCard = {
    orderId: 103, orderNo: 13, status: "Kitchen Phase",
    branchId: "b1", branchName: "Manama", addressLine: null,
    customerPhone: null, courierPhone: null,
    readyAt: null, estimatedHandoverAt: null, estimatedDeliveredAt: null, riskMinutes: null,
    freshnessBudgetMinutes: 20,
};

const ELIGIBLE: CourierBoardRow = {
    courierId: "c1", name: "ali", phone: "39001122", status: "FREE",
    freeAt: "2026-08-08T10:04:00", rank: 0, score: 2.34, noOfferReason: null,
    declinedCount: 2, missedCount: 1, ordersInHand: 0,
    onShiftSince: "2026-08-08T09:12:00",
    positionFixedAt: bahrainLocal(2), positionStaleAfterMinutes: 10,
};

const STALE_FIX: CourierBoardRow = {
    courierId: "c2", name: "sara", phone: null, status: "FREE",
    freeAt: null, rank: null, score: null, noOfferReason: "POSITION_STALE",
    declinedCount: 0, missedCount: 4, ordersInHand: 1,
    onShiftSince: "2026-08-08T08:00:00",
    positionFixedAt: bahrainLocal(90), positionStaleAfterMinutes: 10,
};

const NO_FIX: CourierBoardRow = {
    courierId: "c3", name: "omar", phone: "39554433", status: "BUSY",
    freeAt: "2026-08-08T10:40:00", rank: null, score: null, noOfferReason: "BUSY_UNTIL",
    declinedCount: 0, missedCount: 0, ordersInHand: 2,
    onShiftSince: null, positionFixedAt: null, positionStaleAfterMinutes: 10,
};

/** The picker's own roster, from a different endpoint. Capitalised so it cannot be confused with
 *  ELIGIBLE's "ali" when both are on screen inside the dialog. */
const PICKABLE: CourierStats = {
    courierId: "c1", name: "Ali", status: "FREE",
    nearestBranchId: "b1", nearestBranchName: "Manama",
    accepted: 0, declined: 0, missed: 0, delivered: 0,
};

/** The server's own "still nobody holds this" list — the only orders manual assignment works on. */
const AWAITING_AT_RISK: UnassignedOrder = {
    orderId: 101, orderNo: 11, status: "Ready", branchId: "b1", branchName: "Manama",
    addressLine: "Block 338, Road 3801", waitingMinutes: 14,
};

function renderBoard(props: Partial<DeliveryBoardPanelProps> = {}) {
    const onAssign = jest.fn<void, [number, string]>();
    render(
        <DeliveryBoardPanel
            couriers={[PICKABLE]}
            awaiting={[]}
            onAssign={onAssign}
            {...props}
        />
    );
    return { onAssign };
}

/**
 * Opens the popup for a card and waits for its annotated roster to actually land.
 *
 * Waiting for the section heading alone is not enough: it renders the moment the dialog opens,
 * while the annotated fetch is still in flight and the list is empty — so every assertion about a
 * rider would race the fetch it depends on.
 */
async function openCard(orderNo: string): Promise<void> {
    fireEvent.click(await screen.findByText(orderNo));
    await screen.findByText("Why this order is with this rider and not another");
    await screen.findByTestId("courier-row-c1");
}

/**
 * Reads one labelled figure's value: the label and the value are sibling nodes, so the value is
 * the label node's next sibling — not "some node in the row with that text", which is what makes
 * a paired assertion meaningful. Two figures swapped between their labels would otherwise pass.
 */
function metricValue(scope: HTMLElement, label: string): string {
    const labelNode = within(scope).getByText(label);
    const value = labelNode.nextElementSibling;
    if (value === null) throw new Error(`metric "${label}" has no value beside it`);
    return value.textContent ?? "";
}

/**
 * The board topic handler that is actually live.
 *
 * `useDeliveryBoardEvents` re-subscribes whenever its callback's identity changes — which is every
 * time an order is opened or closed, because that is what re-annotates the roster. The FIRST
 * subscription's handler therefore closes over a `reload` that still believes nothing is open, so
 * driving a frame through it would test a subscription the hook has already replaced.
 */
function boardFrameHandler(): (frame: unknown) => void {
    const handlers = mockSubscribe.mock.calls
        .filter((call) => call[0] === "/topic/delivery-board")
        .map((call) => call[1]);
    const latest = handlers[handlers.length - 1];
    if (latest === undefined) throw new Error("nothing subscribed to the board topic");
    return latest as (frame: unknown) => void;
}

function metricValueNode(scope: HTMLElement, label: string): Element {
    const labelNode = within(scope).getByText(label);
    const value = labelNode.nextElementSibling;
    if (value === null) throw new Error(`metric "${label}" has no value beside it`);
    return value;
}

beforeEach(() => {
    // Mirrors the real contract: connectSocket runs the listener and hands back an unregister.
    // Without the return value the board hook's cleanup throws on unmount.
    mockConnectSocket.mockImplementation((onConnect: () => void) => {
        onConnect();
        return jest.fn<void, []>();
    });
    mockSubscribe.mockReturnValue({ id: "sub-1", unsubscribe: jest.fn<void, []>() });
    mockCards.mockReset();
    mockCouriers.mockReset();
    mockCards.mockResolvedValue([AT_RISK, CALM]);
    mockCouriers.mockResolvedValue([ELIGIBLE, STALE_FIX, NO_FIX]);
});

describe("DeliveryBoardPanel — cards", () => {
    /**
     * The server precomputes the freshness figure and sorts on it, most likely to be late first. A
     * chronological list buries the one order that needs attention, so the board renders the list
     * in the order it arrives and never re-sorts it.
     */
    it("renders the cards risk-first, in the order the server sent them", async () => {
        renderBoard();

        await screen.findByText("#11");
        const numbers = screen.getAllByText(/^#\d+$/).map((node) => node.textContent);
        expect(numbers).toEqual(["#11", "#12"]);
        // Read against the budget the cards carry, so the sort key is visible as the quantity it
        // actually is rather than as a bare integer.
        expect(screen.getByText("48 of 20 min")).toBeTruthy();
        expect(screen.getByText("6 of 20 min")).toBeTruthy();
    });

    /**
     * The manager's next action on a stuck delivery is almost always a phone call, so both numbers
     * live on the card — and an absent one has to say so rather than render as a blank.
     */
    it("shows both phone numbers, and says so when one is absent", async () => {
        renderBoard();

        await screen.findByText("#11");
        const card = screen.getByTestId("delivery-card-101");
        expect(metricValue(card, "Customer")).toBe("33110022");
        expect(metricValue(card, "Courier")).toBe("39887766");
        expect(metricValue(screen.getByTestId("delivery-card-102"), "Courier")).toBe("not assigned");
    });

    /**
     * A number that has to be copied out by hand while a delivery is stuck is a number nobody
     * uses. Dialling must not also open the order behind the call, which is what the row's own
     * click handler would otherwise do.
     */
    it("offers each phone number as a call without opening the order behind it", async () => {
        renderBoard();

        await screen.findByText("#11");
        const card = screen.getByTestId("delivery-card-101");
        const customer = metricValueNode(card, "Customer");

        expect(customer.getAttribute("href")).toBe("tel:33110022");
        expect(metricValueNode(card, "Courier").getAttribute("href")).toBe("tel:39887766");

        fireEvent.click(customer);

        expect(screen.queryByText("Why this order is with this rider and not another")).toBeNull();
        expect(mockCouriers).not.toHaveBeenCalled();
    });

    /**
     * The backend returns null — not zero — when a timing could not be derived. "0 min" would read
     * as an instant handover and quietly misreport an operational metric.
     */
    it("renders an underivable timing as a dash and never as zero", async () => {
        mockCards.mockResolvedValue([UNKNOWABLE]);

        renderBoard();

        await screen.findByText("#13");
        // readyAt, handover and at-the-door are all null on this card.
        expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(3);
        expect(screen.queryByText("0 min")).toBeNull();
    });

    it("renders a naive Bahrain timestamp at its own wall clock, not shifted by three hours", async () => {
        renderBoard();

        // readyAt "2026-08-08T10:00:00" is already Bahrain local; 07:00 or 13:00 would mean the
        // zoneless string was re-interpreted.
        expect(await screen.findByText("10:00")).toBeTruthy();
        expect(screen.queryByText("07:00")).toBeNull();
        expect(screen.queryByText("13:00")).toBeNull();
    });
});

/**
 * The card's headline figure is `DeliveryCardTO.riskMinutes` —
 * `Duration.between(readyAt, estimatedDeliveredAt)`, i.e. how long the food will have been out of
 * the oven when it reaches the customer. It used to render as a bare integer captioned "risk",
 * which names nothing a manager can act on.
 */
describe("DeliveryBoardPanel — the freshness figure", () => {
    it("names the figure and gives it its unit instead of a bare integer captioned risk", async () => {
        // No budget on the card, so the figure is named and measured but not judged. The budget
        // moved onto the card when the server started sending it; a null prop no longer withholds
        // one.
        mockCards.mockResolvedValue([{ ...AT_RISK, freshnessBudgetMinutes: null }]);
        renderBoard();

        await screen.findByText("#11");
        const card = screen.getByTestId("delivery-card-101");

        expect(metricValue(card, "Out of the oven on arrival")).toBe("48 min");
        expect(screen.queryByText("risk")).toBeNull();
    });

    /**
     * The budget is `delivery.freshness.max-minutes-after-ready`, the same number the delivery
     * radius is derived from. Read against it, 48 minutes is an order arriving well outside the
     * window the coverage area was drawn around — which a bare "48" never said.
     */
    it("reads the figure against the budget the server supplies, and marks an overshoot", async () => {
        renderBoard({ freshnessBudgetMinutes: 20 });

        await screen.findByText("#11");
        const over = metricValueNode(screen.getByTestId("delivery-card-101"), "Out of the oven on arrival");
        const within_ = metricValueNode(screen.getByTestId("delivery-card-102"), "Out of the oven on arrival");

        expect(over.textContent).toBe("48 of 20 min");
        expect(within_.textContent).toBe("6 of 20 min");
        expect(emotionRulesFor(over)).toContain(`color:${TONE_BAD}`);
        expect(emotionRulesFor(within_)).toContain(`color:${TONE_OK}`);
        expect(screen.getAllByTestId("freshness-bar").length).toBe(2);
    });

    /**
     * The budget now travels ON the card, so the figure and the window it is judged against can
     * never come from two different places. This drives the prop to a value the cards contradict:
     * a board reading the prop would print "of 20", and only one reading the card prints "of 33".
     */
    it("judges the figure against the budget on the card, not a value of its own", async () => {
        // Arrange
        mockCards.mockResolvedValue([{ ...AT_RISK, freshnessBudgetMinutes: 33 }]);
        renderBoard({ freshnessBudgetMinutes: 20 });

        // Act
        await screen.findByText("#11");
        const value = metricValueNode(screen.getByTestId("delivery-card-101"), "Out of the oven on arrival");

        // Assert
        expect(value.textContent).toBe("48 of 33 min");
    });

    /**
     * Without the server's own budget the client has nothing to judge the figure against, and a
     * colour would be this client's opinion dressed as the engine's. The figure is still named and
     * in minutes — it just makes no claim.
     */
    it("makes no verdict while the budget is unknown", async () => {
        // Unknown means the CARD carries no budget: that is the field the board reads, and the
        // prop is only the fallback for a payload written before the server sent one.
        mockCards.mockResolvedValue([{ ...AT_RISK, freshnessBudgetMinutes: null }]);
        renderBoard({ freshnessBudgetMinutes: null });

        await screen.findByText("#11");
        const value = metricValueNode(screen.getByTestId("delivery-card-101"), "Out of the oven on arrival");

        expect(value.textContent).toBe("48 min");
        expect(emotionRulesFor(value)).not.toContain(`color:${TONE_BAD}`);
        expect(emotionRulesFor(value)).not.toContain(`color:${TONE_OK}`);
        expect(screen.queryByTestId("freshness-bar")).toBeNull();
    });

    /** A figure that could not be computed is not zero and is certainly not "fine". */
    it("reads a null figure as not known, never as zero and never as within budget", async () => {
        mockCards.mockResolvedValue([UNKNOWABLE]);

        renderBoard({ freshnessBudgetMinutes: 20 });

        await screen.findByText("#13");
        const value = metricValueNode(screen.getByTestId("delivery-card-103"), "Out of the oven on arrival");

        expect(value.textContent).toBe("not known");
        expect(emotionRulesFor(value)).not.toContain(`color:${TONE_OK}`);
        expect(screen.queryByTestId("freshness-bar")).toBeNull();
        expect(screen.queryByText("0 of 20 min")).toBeNull();
    });
});

describe("DeliveryBoardPanel — the engine's verdict popup", () => {
    /**
     * Every column of the roster (rank, score, freeAt, the skip reason) is annotated for ONE
     * order, so an unannotated copy sitting on the board answers nothing — which is why it is not
     * fetched, let alone rendered, until an order is opened.
     */
    it("keeps the roster off the board until an order is opened", async () => {
        renderBoard();

        await screen.findByText("#11");
        expect(screen.getByText("Block 338, Road 3801", { exact: false })).toBeTruthy();
        expect(screen.queryByText("ali")).toBeNull();
        expect(mockCouriers).not.toHaveBeenCalled();
    });

    /** The orderId query parameter is the whole point of the link — and it is the id, not the no. */
    it("annotates the roster for the order that was opened", async () => {
        renderBoard();

        await openCard("#11");

        expect(mockCouriers).toHaveBeenCalledWith(101);
        expect(screen.getByText("ali")).toBeTruthy();
        expect(screen.getByText(/Order #11/)).toBeTruthy();
    });

    /**
     * The reason line answers "why is this order still sitting here". It comes straight from the
     * assignment engine and is never recomputed here — but it has to reach the manager as
     * language, not as the raw constant.
     */
    it("renders the engine's no-offer reasons as words, not as raw enums", async () => {
        renderBoard();

        await openCard("#11");

        expect(screen.getByText("Last position too old to trust")).toBeTruthy();
        // "Busy" alone tells a manager nothing; the time says whether to wait or phone around.
        expect(screen.getByText("Busy until 10:40")).toBeTruthy();
        expect(screen.queryByText("POSITION_STALE")).toBeNull();
        expect(screen.queryByText("BUSY_UNTIL")).toBeNull();
    });

    /**
     * rank is the engine's zero-based ordinal within the eligible set — shown 1-based for reading,
     * and never confused with courier_queue.position, which is a sparse key.
     */
    it("shows the engine's own ranking for the eligible courier", async () => {
        renderBoard();

        await openCard("#11");

        expect(screen.getByText("#1 · score 2.3")).toBeTruthy();
    });

    /** A fix past the server's own cutoff must not read as a usable position, and no fix is nowhere. */
    it("marks an unusable position as unusable rather than plausible", async () => {
        renderBoard();

        await openCard("#11");

        expect(screen.getByText(/stale/)).toBeTruthy();
        expect(screen.getByText(/2 min ago/)).toBeTruthy();
        expect(screen.getByText("No position fix")).toBeTruthy();
    });

    /** Null, not "": "not filled in" has to stay distinguishable from "filled in as blank". */
    it("renders a missing courier phone as genuinely absent", async () => {
        renderBoard();

        await openCard("#11");

        expect(screen.getByText("No phone on file")).toBeTruthy();
        expect(screen.getByText("39001122")).toBeTruthy();
    });

    /**
     * Declined and missed never merge: a rider who refuses is making a choice, one who goes silent
     * probably has a dead phone, and the two call for different conversations (manual §03).
     *
     * The numbers are read out of their OWN metric rather than looked up anywhere in the row: the
     * label and the value are sibling nodes, so a row-wide `getByText("2")` would still pass with
     * the two figures swapped — which is precisely the regression this exists to catch.
     */
    it("keeps declined and missed as separate counts", async () => {
        renderBoard();

        await openCard("#11");
        const row = screen.getByTestId("courier-row-c1");

        expect(metricValue(row, "Declined")).toBe("2");
        expect(metricValue(row, "Missed")).toBe("1");
    });

    it("closes the popup and forgets the annotation", async () => {
        renderBoard();

        await openCard("#11");
        fireEvent.click(screen.getByRole("button", { name: "Close" }));

        await waitFor(() =>
            expect(screen.queryByText("Why this order is with this rider and not another")).toBeNull()
        );
        expect(screen.getByText("#11")).toBeTruthy();
    });

    /**
     * An order concludes and drops off the card list while the popup is open. Leaving its ranking
     * on screen would answer a question nobody is asking any more.
     */
    it("drops a popup whose card is no longer live", async () => {
        renderBoard();

        await openCard("#11");

        mockCards.mockResolvedValue([CALM]);
        const handler = boardFrameHandler();
        await act(async () => { handler({}); });

        await waitFor(() =>
            expect(screen.queryByText("Why this order is with this rider and not another")).toBeNull()
        );
        expect(screen.getByText("#12")).toBeTruthy();
    });
});

describe("DeliveryBoardPanel — assigning by hand from the board", () => {
    /**
     * `OrderRepository.claimForCourier` only matches a row whose `assigned_courier_id is null`, so
     * the server's own waiting list — not the card's `courierPhone`, which is also null for a
     * rider with no number on file — decides whether the picker is offered.
     */
    it("offers the picker for an order the server still lists as unassigned", async () => {
        const { onAssign } = renderBoard({ awaiting: [AWAITING_AT_RISK] });

        await openCard("#11");
        fireEvent.click(screen.getByRole("radio", { name: "Ali" }));
        fireEvent.click(screen.getByRole("button", { name: "Assign" }));

        expect(onAssign).toHaveBeenCalledWith(101, "c1");
    });

    it("offers no picker on an order a rider already holds, and says why", async () => {
        const { onAssign } = renderBoard({ awaiting: [AWAITING_AT_RISK] });

        await openCard("#12");

        expect(screen.getByText(/A courier already holds this order/)).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Assign" })).toBeNull();
        expect(screen.queryByRole("radio", { name: "Ali" })).toBeNull();
        // The verdict itself is still there — that is the whole reason the popup opened.
        expect(screen.getByText("ali")).toBeTruthy();
        expect(onAssign).not.toHaveBeenCalled();
    });
});

describe("DeliveryBoardPanel — live updates", () => {
    it("subscribes to the cross-branch delivery topic", async () => {
        renderBoard();

        await screen.findByText("#11");
        expect(mockSubscribe).toHaveBeenCalledWith("/topic/delivery-board", expect.any(Function));
    });

    it("refetches the cards, and the open order's verdict, when the board signals a change", async () => {
        renderBoard();
        await openCard("#11");

        const cardCallsBefore = mockCards.mock.calls.length;
        const courierCallsBefore = mockCouriers.mock.calls.length;
        const handler = boardFrameHandler();

        await act(async () => { handler({}); });

        await waitFor(() => expect(mockCards.mock.calls.length).toBeGreaterThan(cardCallsBefore));
        await waitFor(() => expect(mockCouriers.mock.calls.length).toBeGreaterThan(courierCallsBefore));
    });

    it("surfaces a failed request instead of rendering an empty board", async () => {
        mockCards.mockRejectedValue(new Error("Response: 403"));

        renderBoard();

        expect(await screen.findByText(/Response: 403/)).toBeTruthy();
    });
});

describe("DeliveryBoardPanel — layout", () => {
    /**
     * The case the floor exists for: an empty board between the waiting queue above it and the
     * courier roster below. Without it the card collapses to the height of its own one-line empty
     * state and the board looks broken rather than quiet.
     */
    it("gives an empty board a floor instead of letting it collapse", async () => {
        mockCards.mockResolvedValue([]);

        renderBoard();
        const emptyCard = await screen.findByTestId("live-deliveries-card");

        expect(await screen.findByText("Nothing is out for delivery right now.")).toBeTruthy();
        expect(emotionRulesFor(emptyCard)).toContain(`min-height:${PANEL_MIN_HEIGHT}px`);
    });
});
