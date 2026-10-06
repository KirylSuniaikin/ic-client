import { jest, describe, it, expect, beforeEach, beforeAll } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor, act, within } from "@testing-library/react";
import { DeliveryBoardPanel } from "./DeliveryBoardPanel";
import type { DeliveryBoardPanelProps } from "./DeliveryBoardPanel";
import { fetchBoardCouriers, fetchDeliveryCards } from "../../../../shared/api/dispatcher";
import type {
    CourierBoardRow, CourierStats, DeliveryCard, ManualAssignResult, UnassignedOrder,
} from "../types";
import { connectSocket, socket } from "../../../../shared/api/socket";
import { PANEL_MIN_HEIGHT, TONE_BAD, TONE_OK } from "./dispatcherStyles";
import { emotionRulesFor } from "./emotionRules.testutil";

jest.mock("../../../../shared/api/socket");
jest.mock("../../../../shared/api/dispatcher");
// The order dialog's assignment history fetches for itself and has its own suite
// (DeliveryAssignmentTimeline.test.tsx); here it is inert so the automocked API is not asked for it.
jest.mock("./DeliveryAssignmentTimeline", () => ({ DeliveryAssignmentTimeline: () => null }));

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
    customerName: "Ali", customerPhone: "33110022", courierPhone: "39887766",
    readyAt: "2026-08-08T10:00:00", estimatedHandoverAt: "2026-08-08T10:05:00",
    estimatedDeliveredAt: "2026-08-08T10:48:00", riskMinutes: 48,
    promisedAt: "2026-08-08T10:40:00", promisedTotalMinutes: 30,
    freshnessBudgetMinutes: 20,
    items: [{ name: "Pepperoni", quantity: 2 }],
};

const CALM: DeliveryCard = {
    orderId: 102, orderNo: 12, status: "Kitchen Phase",
    branchId: "b1", branchName: "Manama", addressLine: "Block 12, Road 4",
    customerName: "Noor", customerPhone: "33445566", courierPhone: null,
    readyAt: "2026-08-08T11:00:00", estimatedHandoverAt: "2026-08-08T11:02:00",
    estimatedDeliveredAt: "2026-08-08T11:06:00", riskMinutes: 6,
    promisedAt: "2026-08-08T11:20:00", promisedTotalMinutes: 30,
    freshnessBudgetMinutes: 20,
    items: [{ name: "Margherita", quantity: 1 }],
};

/** Nothing about this one is derivable yet — every timing came back null, not zero. */
const UNKNOWABLE: DeliveryCard = {
    orderId: 103, orderNo: 13, status: "Kitchen Phase",
    branchId: "b1", branchName: "Manama", addressLine: null,
    customerName: null, customerPhone: null, courierPhone: null,
    readyAt: null, estimatedHandoverAt: null, estimatedDeliveredAt: null, riskMinutes: null,
    promisedAt: null, promisedTotalMinutes: null,
    freshnessBudgetMinutes: 20,
    items: [],
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
    pizzaCount: 3, couriersNeeded: 1, oversized: false,
    partId: 1011, partIndex: 1, partsTotal: 1,
};

function renderBoard(props: Partial<DeliveryBoardPanelProps> = {}) {
    const onAssign = jest.fn<Promise<ManualAssignResult>, [number, string, boolean]>();
    onAssign.mockResolvedValue({ assigned: true, warning: null });
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
 * Opens the popup for an order that is still being handed out, and waits for its annotated roster
 * to actually land.
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
 * Opens the popup for a delivery already in flight, where there is no roster to wait for — the
 * ranking is gone and the details block is what renders.
 */
async function openLiveCard(orderNo: string): Promise<void> {
    fireEvent.click(await screen.findByText(orderNo));
    await screen.findByTestId("delivery-order-details");
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
    it("renders the cards in the order the server sent them", async () => {
        renderBoard();

        await screen.findByText("#11");
        const numbers = screen.getAllByText(/^#\d+$/).map((node) => node.textContent);
        expect(numbers).toEqual(["#11", "#12"]);
    });

    /**
     * The card leads with how long is left, not with how old the food will be. The second is a
     * diagnosis a manager reads against a budget; the first is what they are scanning the board
     * for, and it is the same ring the kitchen card already uses.
     */
    it("counts down to the promise rather than printing a food age", async () => {
        // A fixed clock, so the figure is an exact assertion rather than "some mm:ss appeared":
        // AT_RISK is promised for 10:40 Bahrain, and it is 10:15 there.
        jest.useFakeTimers().setSystemTime(new Date("2026-08-08T07:15:00.000Z"));
        try {
            renderBoard();

            await screen.findByText("#11");
            const card = screen.getByTestId("delivery-card-101");

            expect(within(card).getByText("25:00")).toBeTruthy();
            expect(within(card).queryByText("48 of 20 min")).toBeNull();
        } finally {
            jest.useRealTimers();
        }
    });

    /**
     * An order from before the road quote existed carries no promise and never can — the quote
     * depended on that minute's traffic. A ring drawn against a number nobody recorded would be a
     * confident answer to a question we cannot answer.
     */
    it("says so for an order with no promised time, rather than drawing an empty ring", async () => {
        mockCards.mockResolvedValue([UNKNOWABLE]);
        renderBoard();

        await screen.findByText("#13");

        expect(screen.getByTestId("delivery-card-103-no-deadline")).toBeTruthy();
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
 * How old the food will be on arrival — `Duration.between(readyAt, estimatedDeliveredAt)`.
 *
 * It used to be the card's headline. It is now in the POPUP the card opens: it is a diagnosis
 * rather than a priority, and a manager has to read it against a budget before it means anything,
 * which is a sentence's worth of work on a surface meant to be scanned. The card leads with the
 * countdown instead — how long is left — and this answers the question after it.
 */
describe("DeliveryBoardPanel — the freshness figure in the popup", () => {
    /** The popup shows one order, so each case opens the card it is about. */
    async function detailsFor(orderNo: string): Promise<HTMLElement> {
        await openLiveCard(orderNo);
        return screen.getByTestId("delivery-order-details");
    }

    it("names the figure and gives it its unit instead of a bare integer captioned risk", async () => {
        // No budget on the card, so the figure is named and measured but not judged.
        mockCards.mockResolvedValue([{ ...AT_RISK, freshnessBudgetMinutes: null }]);
        renderBoard();

        const details = await detailsFor("#11");

        expect(metricValue(details, "Out of the oven on arrival")).toBe("48 min");
        expect(screen.queryByText("risk")).toBeNull();
    });

    /**
     * The budget is `delivery.freshness.max-minutes-after-ready`, the same number the coverage
     * area is derived from. Read against it, 48 minutes is an order arriving well outside the
     * window that area was drawn around — which a bare "48" never said.
     */
    it("reads the figure against the budget the server supplies, and marks an overshoot", async () => {
        renderBoard();

        const details = await detailsFor("#11");
        const over = metricValueNode(details, "Out of the oven on arrival");

        expect(over.textContent).toBe("48 of 20 min");
        expect(emotionRulesFor(over)).toContain(`color:${TONE_BAD}`);
        expect(screen.getByTestId("freshness-bar")).toBeTruthy();
    });

    it("marks an order inside its budget as such", async () => {
        renderBoard();

        const details = await detailsFor("#12");
        const withinBudget = metricValueNode(details, "Out of the oven on arrival");

        expect(withinBudget.textContent).toBe("6 of 20 min");
        expect(emotionRulesFor(withinBudget)).toContain(`color:${TONE_OK}`);
    });

    /**
     * The budget travels ON the card, so the figure and the window it is judged against can never
     * come from two different places. This drives the panel's own prop to a value the card
     * contradicts: a client reading the prop would print "of 20", and only one reading the card
     * prints "of 33".
     */
    it("judges the figure against the budget on the card, not a value of its own", async () => {
        // Arrange
        mockCards.mockResolvedValue([{ ...AT_RISK, freshnessBudgetMinutes: 33 }]);
        renderBoard({ freshnessBudgetMinutes: 20 });

        // Act
        const details = await detailsFor("#11");

        // Assert
        expect(metricValueNode(details, "Out of the oven on arrival").textContent)
            .toBe("48 of 33 min");
    });

    /**
     * Without the server's own budget the client has nothing to judge the figure against, and a
     * colour would be this client's opinion dressed as the engine's. The figure is still named and
     * in minutes — it just makes no claim.
     */
    it("makes no verdict while the budget is unknown", async () => {
        // Arrange
        mockCards.mockResolvedValue([{ ...AT_RISK, freshnessBudgetMinutes: null }]);
        renderBoard({ freshnessBudgetMinutes: null });

        // Act
        const details = await detailsFor("#11");
        const value = metricValueNode(details, "Out of the oven on arrival");

        // Assert
        expect(value.textContent).toBe("48 min");
        expect(emotionRulesFor(value)).not.toContain(`color:${TONE_BAD}`);
        expect(emotionRulesFor(value)).not.toContain(`color:${TONE_OK}`);
        expect(screen.queryByTestId("freshness-bar")).toBeNull();
    });

    /** A figure that could not be computed is not zero and is certainly not "fine". */
    it("reads a null figure as not known, never as zero and never as within budget", async () => {
        // Arrange
        mockCards.mockResolvedValue([UNKNOWABLE]);
        renderBoard({ freshnessBudgetMinutes: 20 });

        // Act
        const details = await detailsFor("#13");
        const value = metricValueNode(details, "Out of the oven on arrival");

        // Assert
        expect(value.textContent).toBe("not known");
        expect(emotionRulesFor(value)).not.toContain(`color:${TONE_OK}`);
        expect(screen.queryByTestId("freshness-bar")).toBeNull();
        expect(screen.queryByText("0 of 20 min")).toBeNull();
    });
});

/**
 * The ranking is now shown ONLY while an order is still being handed out, so every test in this
 * block puts the opened card on the server's waiting list. That is not a fixture detail: on a
 * delivery a rider already holds, the ranking explains a decision that has been made, and it was
 * pushing the order itself — the customer, the number to ring, what is in the box — off the top of
 * the popup. See the block below for what that card shows instead.
 */
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
        renderBoard({ awaiting: [AWAITING_AT_RISK] });

        await openCard("#11");

        expect(mockCouriers).toHaveBeenCalledWith(101);
        expect(screen.getByText("ali")).toBeTruthy();
        // "Assign order #11" while it is still being handed out; plain "Order #11" once it is not.
        expect(screen.getByText(/Assign order #11/)).toBeTruthy();
    });

    /**
     * The reason line answers "why is this order still sitting here". It comes straight from the
     * assignment engine and is never recomputed here — but it has to reach the manager as
     * language, not as the raw constant.
     */
    it("renders the engine's no-offer reasons as words, not as raw enums", async () => {
        renderBoard({ awaiting: [AWAITING_AT_RISK] });

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
        renderBoard({ awaiting: [AWAITING_AT_RISK] });

        await openCard("#11");

        expect(screen.getByText("#1 · score 2.3")).toBeTruthy();
    });

    /** A fix past the server's own cutoff must not read as a usable position, and no fix is nowhere. */
    it("marks an unusable position as unusable rather than plausible", async () => {
        renderBoard({ awaiting: [AWAITING_AT_RISK] });

        await openCard("#11");

        expect(screen.getByText(/stale/)).toBeTruthy();
        expect(screen.getByText(/2 min ago/)).toBeTruthy();
        expect(screen.getByText("No position fix")).toBeTruthy();
    });

    /** Null, not "": "not filled in" has to stay distinguishable from "filled in as blank". */
    it("renders a missing courier phone as genuinely absent", async () => {
        renderBoard({ awaiting: [AWAITING_AT_RISK] });

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
        renderBoard({ awaiting: [AWAITING_AT_RISK] });

        await openCard("#11");
        const row = screen.getByTestId("courier-row-c1");

        expect(metricValue(row, "Declined")).toBe("2");
        expect(metricValue(row, "Missed")).toBe("1");
    });

    it("closes the popup and forgets the annotation", async () => {
        renderBoard({ awaiting: [AWAITING_AT_RISK] });

        await openCard("#11");
        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

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
        renderBoard({ awaiting: [AWAITING_AT_RISK] });

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

/**
 * What a dispatcher gets for opening a card.
 *
 * The popup used to lead with the assignment engine's ranking and give the order one grey line of
 * address. That is the right screen for choosing a rider and the wrong one for a delivery already
 * in flight: by then the decision is made, and what the dispatcher is about to do is phone
 * somebody. These tests pin the content of that call — who to greet, which number to dial, what is
 * in the box, and whether the time went in the kitchen or on the road.
 */
describe("DeliveryBoardPanel — the order popup", () => {
    it("names the customer, not just their number", async () => {
        renderBoard();

        await openLiveCard("#11");

        expect(screen.getByText("Ali")).toBeTruthy();
    });

    it("lists what was ordered", async () => {
        renderBoard();

        await openLiveCard("#11");

        expect(screen.getByText("Pepperoni")).toBeTruthy();
        expect(screen.getByText("2×")).toBeTruthy();
    });

    /**
     * Both numbers, in the popup and not only on the card behind it — the card is the list view a
     * manager scans, the popup is the one they are looking at while the phone rings.
     */
    it("carries both phone numbers", async () => {
        renderBoard();

        await openLiveCard("#11");

        const details = screen.getByTestId("delivery-order-details");
        expect(within(details).getByText("33110022")).toBeTruthy();
        expect(within(details).getByText("39887766")).toBeTruthy();
    });

    /**
     * An order with no items is a real state — one whose lines were edited away — and it has to
     * read as a fact rather than as a section that quietly vanished, or the dispatcher cannot tell
     * it from a popup that failed to load.
     */
    it("says so when there are no items, rather than dropping the section", async () => {
        mockCards.mockResolvedValue([UNKNOWABLE]);
        renderBoard();

        await openLiveCard("#13");

        expect(screen.getByText("No items on file")).toBeTruthy();
    });

    it("says so when the customer left no name and no number", async () => {
        mockCards.mockResolvedValue([UNKNOWABLE]);
        renderBoard();

        await openLiveCard("#13");

        const details = screen.getByTestId("delivery-order-details");
        expect(within(details).getByText("No name on file")).toBeTruthy();
        expect(within(details).getByText("no number on file")).toBeTruthy();
    });

    /**
     * Three stamps rather than one figure. "Ready 10:00, handover 10:05, door 10:48" says the food
     * sat on the road; the same total with a late Ready says it sat in the kitchen. That is the
     * only diagnosis the popup can offer, and it decides which of the two numbers gets dialled.
     */
    it("shows all three timings so the delay can be placed", async () => {
        renderBoard();

        await openLiveCard("#11");

        const details = screen.getByTestId("delivery-order-details");
        expect(within(details).getByText("Ready")).toBeTruthy();
        expect(within(details).getByText("Handover")).toBeTruthy();
        expect(within(details).getByText("At the door")).toBeTruthy();
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

        expect(onAssign).toHaveBeenCalledWith(101, "c1", false);
    });

    it("offers no picker on an order a rider already holds, and says why", async () => {
        const { onAssign } = renderBoard({ awaiting: [AWAITING_AT_RISK] });

        await openLiveCard("#12");

        expect(screen.getByText(/A courier already holds this order/)).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Assign" })).toBeNull();
        expect(screen.queryByRole("radio", { name: "Ali" })).toBeNull();
        expect(onAssign).not.toHaveBeenCalled();
    });

    /**
     * Server-authoritative two-step (courier-capacity, task-spec.md §5): `assigned: true` is this
     * panel's own cue to close the popup, exactly as the old fire-and-forget `onAssign` did.
     */
    it("closes the popup once the server actually assigns", async () => {
        renderBoard({ awaiting: [AWAITING_AT_RISK] });

        await openCard("#11");
        fireEvent.click(screen.getByRole("radio", { name: "Ali" }));
        fireEvent.click(screen.getByRole("button", { name: "Assign" }));

        await waitFor(() =>
            expect(screen.queryByText("Why this order is with this rider and not another")).toBeNull()
        );
    });

    /**
     * `assigned: false` means nothing changed server-side — the popup has to stay open with the
     * warning showing, not close as if the hand-over had happened.
     */
    it("keeps the popup open when the server refuses over capacity", async () => {
        const onAssign = jest.fn<Promise<ManualAssignResult>, [number, string, boolean]>();
        onAssign.mockResolvedValue({
            assigned: false,
            warning: { riderPizzas: 6, orderPizzas: 4, totalPizzas: 10, capacity: 8 },
        });
        render(
            <DeliveryBoardPanel couriers={[PICKABLE]} awaiting={[AWAITING_AT_RISK]} onAssign={onAssign} />
        );

        await openCard("#11");
        const cardCallsBefore = mockCards.mock.calls.length;
        const courierCallsBefore = mockCouriers.mock.calls.length;
        fireEvent.click(screen.getByRole("radio", { name: "Ali" }));
        fireEvent.click(screen.getByRole("button", { name: "Assign" }));

        expect(await screen.findByText(/already carrying 6 pizza/)).toBeTruthy();
        expect(screen.getByText("Why this order is with this rider and not another")).toBeTruthy();
        expect(screen.getByRole("button", { name: "Assign anyway" })).toBeTruthy();
        // Requirement 19: nothing changed server-side on `assigned: false`, so neither the cards
        // nor the annotated roster are refetched — only a real `assigned: true` earns a reload.
        expect(mockCards.mock.calls.length).toBe(cardCallsBefore);
        expect(mockCouriers.mock.calls.length).toBe(courierCallsBefore);
    });

    /**
     * Issue 1 (review iteration 1): before this fix, a rejected `onAssign` reached the dialog's own
     * empty catch and did nothing — the popup stayed open over an order that, in production, may
     * already have moved. `assigned: false` (above) is a normal 200 the popup must survive; this is
     * a real failure (network/5xx, or the 409 the other mount site's test already covers), which
     * must close it instead.
     */
    it("closes the popup when manualAssign rejects", async () => {
        const onAssign = jest.fn<Promise<ManualAssignResult>, [number, string, boolean]>();
        onAssign.mockRejectedValue(new Error("Response: 409"));
        render(
            <DeliveryBoardPanel couriers={[PICKABLE]} awaiting={[AWAITING_AT_RISK]} onAssign={onAssign} />
        );

        await openCard("#11");
        fireEvent.click(screen.getByRole("radio", { name: "Ali" }));
        fireEvent.click(screen.getByRole("button", { name: "Assign" }));

        await waitFor(() =>
            expect(screen.queryByText("Why this order is with this rider and not another")).toBeNull()
        );
        // The wrapper settles the dialog's own promise with a benign
        // `{ assigned: false, warning: null }` fallback — but the popup is already gone, so there
        // is nothing left for that fallback to be misread as: no warning, no relabelled button, no
        // radio still sitting on screen as if the popup had merely refreshed.
        expect(screen.queryByText(/already carrying/)).toBeNull();
        expect(screen.queryByRole("button", { name: "Assign anyway" })).toBeNull();
        expect(screen.queryByRole("radio", { name: "Ali" })).toBeNull();
    });
});

/**
 * Courier-capacity Phase 5 (D7/task-spec.md §11 P5): once an order is genuinely split, this board
 * is read-only for assignment — per-part assign lives only in the waiting-for-a-courier queue.
 */
describe("DeliveryBoardPanel — a genuinely split card (courier-capacity Phase 5)", () => {
    it("forces assignable false for a split card even though the server still lists it as awaiting", async () => {
        const splitCard: DeliveryCard = { ...AT_RISK, partsTotal: 2 };
        mockCards.mockResolvedValue([splitCard]);
        renderBoard({ awaiting: [AWAITING_AT_RISK] });

        await openLiveCard("#11");

        expect(screen.getByText(/A courier already holds this order/)).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Assign" })).toBeNull();
    });

    it("leaves a non-split card's assignable behaviour unchanged", async () => {
        const { onAssign } = renderBoard({ awaiting: [AWAITING_AT_RISK] });

        await openCard("#11");
        fireEvent.click(screen.getByRole("radio", { name: "Ali" }));
        fireEvent.click(screen.getByRole("button", { name: "Assign" }));

        expect(onAssign).toHaveBeenCalledWith(101, "c1", false);
    });
});

describe("DeliveryBoardPanel — live updates", () => {
    it("subscribes to the cross-branch delivery topic", async () => {
        renderBoard();

        await screen.findByText("#11");
        expect(mockSubscribe).toHaveBeenCalledWith("/topic/delivery-board", expect.any(Function));
    });

    it("refetches the cards, and the open order's verdict, when the board signals a change", async () => {
        renderBoard({ awaiting: [AWAITING_AT_RISK] });
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
