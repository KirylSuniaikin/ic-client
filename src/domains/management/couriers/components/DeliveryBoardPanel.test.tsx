import { jest, describe, it, expect, beforeEach, beforeAll } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor, act, within } from "@testing-library/react";
import { DeliveryBoardPanel } from "./DeliveryBoardPanel";
import { fetchBoardCouriers, fetchDeliveryCards } from "../../../../shared/api/dispatcher";
import type { CourierBoardRow, DeliveryCard } from "../types";
import { connectSocket, socket } from "../../../../shared/api/socket";

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
};

const CALM: DeliveryCard = {
    orderId: 102, orderNo: 12, status: "Kitchen Phase",
    branchId: "b1", branchName: "Manama", addressLine: "Block 12, Road 4",
    customerPhone: "33445566", courierPhone: null,
    readyAt: "2026-08-08T11:00:00", estimatedHandoverAt: "2026-08-08T11:02:00",
    estimatedDeliveredAt: "2026-08-08T11:06:00", riskMinutes: 6,
};

/** Nothing about this one is derivable yet — every timing came back null, not zero. */
const UNKNOWABLE: DeliveryCard = {
    orderId: 103, orderNo: 13, status: "Kitchen Phase",
    branchId: "b1", branchName: "Manama", addressLine: null,
    customerPhone: null, courierPhone: null,
    readyAt: null, estimatedHandoverAt: null, estimatedDeliveredAt: null, riskMinutes: null,
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
     * The server precomputes riskMinutes and sorts on it, most likely to be late first. A
     * chronological list buries the one order that needs attention, so the board renders the list
     * in the order it arrives and never re-sorts it.
     */
    it("renders the cards risk-first, in the order the server sent them", async () => {
        render(<DeliveryBoardPanel />);

        await screen.findByText("#11");
        const numbers = screen.getAllByText(/^#\d+$/).map((node) => node.textContent);
        expect(numbers).toEqual(["#11", "#12"]);
        expect(screen.getByText("48 min")).toBeTruthy();
        expect(screen.getByText("6 min")).toBeTruthy();
    });

    /**
     * The manager's next action on a stuck delivery is almost always a phone call, so both numbers
     * live on the card — and an absent one has to say so rather than render as a blank.
     */
    it("shows both phone numbers, and says so when one is absent", async () => {
        render(<DeliveryBoardPanel />);

        expect(await screen.findByText("39887766")).toBeTruthy();
        expect(screen.getByText("33110022")).toBeTruthy();
        expect(screen.getByText("not assigned")).toBeTruthy();
    });

    /**
     * The backend returns null — not zero — when a timing could not be derived. "0 min" would read
     * as an instant handover and quietly misreport an operational metric.
     */
    it("renders an underivable timing as a dash and never as zero", async () => {
        mockCards.mockResolvedValue([UNKNOWABLE]);

        render(<DeliveryBoardPanel />);

        await screen.findByText("#13");
        // readyAt, handover, at-the-door and risk are all null on this card.
        expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(4);
        expect(screen.queryByText("0 min")).toBeNull();
    });

    it("renders a naive Bahrain timestamp at its own wall clock, not shifted by three hours", async () => {
        render(<DeliveryBoardPanel />);

        // readyAt "2026-08-08T10:00:00" is already Bahrain local; 07:00 or 13:00 would mean the
        // zoneless string was re-interpreted.
        expect(await screen.findByText("10:00")).toBeTruthy();
        expect(screen.queryByText("07:00")).toBeNull();
        expect(screen.queryByText("13:00")).toBeNull();
    });
});

describe("DeliveryBoardPanel — linked panels", () => {
    it("starts as an unannotated roster", async () => {
        render(<DeliveryBoardPanel />);

        await screen.findByText("ali");
        expect(mockCouriers).toHaveBeenCalledWith(null);
        expect(screen.getByText("Courier availability")).toBeTruthy();
    });

    /** The orderId query parameter is the whole point of the link — and it is the id, not the no. */
    it("re-annotates the courier table for the selected card", async () => {
        render(<DeliveryBoardPanel />);

        fireEvent.click(await screen.findByText("#11"));

        await waitFor(() => expect(mockCouriers).toHaveBeenCalledWith(101));
        expect(await screen.findByText("Couriers for #11")).toBeTruthy();
    });

    it("clears the annotation when the same card is picked again", async () => {
        render(<DeliveryBoardPanel />);

        fireEvent.click(await screen.findByText("#11"));
        await waitFor(() => expect(mockCouriers).toHaveBeenCalledWith(101));

        fireEvent.click(screen.getByText("#11"));

        expect(await screen.findByText("Courier availability")).toBeTruthy();
    });

    /**
     * An order concludes and drops off the card list while the board is open. Leaving its ranking
     * on the courier table would answer a question nobody is asking any more.
     */
    it("drops a selection whose card is no longer live", async () => {
        render(<DeliveryBoardPanel />);

        fireEvent.click(await screen.findByText("#11"));
        await screen.findByText("Couriers for #11");

        mockCards.mockResolvedValue([CALM]);
        const handler = mockSubscribe.mock.calls.find(
            (call) => call[0] === "/topic/delivery-board"
        )?.[1] as (frame: unknown) => void;
        await act(async () => { handler({}); });

        expect(await screen.findByText("Courier availability")).toBeTruthy();
    });
});

describe("DeliveryBoardPanel — courier table", () => {
    /**
     * The reason column is the one that answers "why is this order still sitting here". It comes
     * straight from the assignment engine and is never recomputed here — but it has to reach the
     * manager as language, not as the raw constant.
     */
    it("renders the engine's no-offer reason as words, not as a raw enum", async () => {
        render(<DeliveryBoardPanel />);

        expect(await screen.findByText("Last position too old to trust")).toBeTruthy();
        expect(screen.queryByText("POSITION_STALE")).toBeNull();
        expect(screen.queryByText("BUSY_UNTIL")).toBeNull();
    });

    /** "Busy" alone tells a manager nothing; the time tells them whether to wait or phone around. */
    it("carries freeAt into the busy reason", async () => {
        render(<DeliveryBoardPanel />);

        expect(await screen.findByText("Busy until 10:40")).toBeTruthy();
    });

    /**
     * rank is the engine's zero-based ordinal within the eligible set — shown 1-based for reading,
     * and never confused with courier_queue.position, which is a sparse key.
     */
    it("shows the engine's own ranking for the eligible courier", async () => {
        render(<DeliveryBoardPanel />);

        expect(await screen.findByText("#1 · score 2.3")).toBeTruthy();
    });

    /** A fix past the server's own cutoff must not read as a usable position. */
    it("marks a position fix past the staleness cutoff as stale", async () => {
        render(<DeliveryBoardPanel />);

        expect(await screen.findByText(/stale/)).toBeTruthy();
        expect(screen.getByText(/2 min ago/)).toBeTruthy();
    });

    /** A courier with no fix is nowhere — never "near everything". */
    it("says a courier has no position fix at all rather than showing a blank", async () => {
        render(<DeliveryBoardPanel />);

        expect(await screen.findByText("No position fix")).toBeTruthy();
    });

    /** Null, not "": "not filled in" has to stay distinguishable from "filled in as blank". */
    it("renders a missing courier phone as genuinely absent", async () => {
        render(<DeliveryBoardPanel />);

        expect(await screen.findByText("No phone on file")).toBeTruthy();
        expect(screen.getByText("39001122")).toBeTruthy();
    });

    /** Declined and missed never merge: a choice and a dead phone are different problems. */
    it("keeps declined and missed as separate counts", async () => {
        render(<DeliveryBoardPanel />);

        await screen.findByText("ali");
        const row = within(screen.getByTestId("courier-row-c1"));
        expect(row.getByText("Declined")).toBeTruthy();
        expect(row.getByText("2")).toBeTruthy();
        expect(row.getByText("Missed")).toBeTruthy();
        expect(row.getByText("1")).toBeTruthy();
    });
});

describe("DeliveryBoardPanel — live updates", () => {
    it("subscribes to the cross-branch delivery topic", async () => {
        render(<DeliveryBoardPanel />);

        await screen.findByText("ali");
        expect(mockSubscribe).toHaveBeenCalledWith("/topic/delivery-board", expect.any(Function));
    });

    it("refetches both panels when the board signals a change", async () => {
        render(<DeliveryBoardPanel />);
        await screen.findByText("ali");

        const cardCallsBefore = mockCards.mock.calls.length;
        const courierCallsBefore = mockCouriers.mock.calls.length;
        const handler = mockSubscribe.mock.calls.find(
            (call) => call[0] === "/topic/delivery-board"
        )?.[1] as (frame: unknown) => void;

        await act(async () => { handler({}); });

        await waitFor(() => expect(mockCards.mock.calls.length).toBeGreaterThan(cardCallsBefore));
        await waitFor(() => expect(mockCouriers.mock.calls.length).toBeGreaterThan(courierCallsBefore));
    });

    it("surfaces a failed request instead of rendering an empty board", async () => {
        mockCards.mockRejectedValue(new Error("Response: 403"));

        render(<DeliveryBoardPanel />);

        expect(await screen.findByText(/Response: 403/)).toBeTruthy();
    });
});
