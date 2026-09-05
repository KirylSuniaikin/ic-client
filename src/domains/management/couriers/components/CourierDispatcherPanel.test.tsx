import { jest, describe, it, expect, beforeEach, beforeAll } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { CourierDispatcherPanel } from "./CourierDispatcherPanel";
import {
    cancelOrder, fetchBoardCouriers, fetchCouriers, fetchCourierOrders, fetchDeliveryCards,
    fetchOrderProofPhoto, fetchOrderRoute, fetchOrdersAwaitingCourier, manualAssign, releaseOrder,
} from "../../../../shared/api/dispatcher";
import type {
    CourierBoardRow, CourierOrderSummary, CourierStats, OrderRoute, UnassignedOrder,
} from "../types";
import { connectSocket, socket } from "../../../../shared/api/socket";
import { emotionRulesFor } from "./emotionRules.testutil";

jest.mock("../../../../shared/api/socket");
jest.mock("../../../../shared/api/dispatcher");

// The Maps key decides whether the route drill-down draws a map or falls back to the coordinate
// list, and it is a module const read from process.env at import time — so it is exposed through
// a getter here rather than a fixed value, which a plain object factory would freeze.
// The `mock` name prefix is what lets the hoisted factory close over it.
const mockMapsKey: { value: string | undefined } = { value: undefined };
jest.mock("../../../branch/utils/mapsConfig", () => ({
    get GOOGLE_MAPS_API_KEY(): string | undefined { return mockMapsKey.value; },
    GOOGLE_MAPS_MAP_ID: undefined,
    LIGHT_MAP_STYLES: [],
}));

// The map itself is covered by OrderRouteMap.test.tsx against a fake Google loader; here it is a
// probe, so these tests keep asserting on which of the two renderings the panel chose.
// The per-courier stats panel has its own suite (CourierPeriodStatsPanel.test.tsx). Stubbed here
// so these tests keep asserting on the drill-down, not on the panel's own fetch.
jest.mock("./CourierPeriodStatsPanel", () => ({
    CourierPeriodStatsPanel: ({ courierId }: { courierId: string }) => (
        <div data-testid="courier-period-stats">{courierId}</div>
    ),
}));

jest.mock("./OrderRouteMap", () => ({
    OrderRouteMap: ({ route }: { route: { points: unknown[] } }) => (
        <div data-testid="order-route-map">{route.points.length}</div>
    ),
}));

beforeAll(() => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
});

const mockCouriers = jest.mocked(fetchCouriers);
const mockOrders = jest.mocked(fetchCourierOrders);
const mockRoute = jest.mocked(fetchOrderRoute);
const mockConnectSocket = jest.mocked(connectSocket);
// jest.mocked, not a `jest.Mock` annotation: there is no @types/jest here, so the type
// form compiles under Babel and fails tsc — see ic-client/.claude/CLAUDE.md.
const mockSubscribe = jest.mocked(socket.subscribe);
const mockAwaiting = jest.mocked(fetchOrdersAwaitingCourier);
const mockAssign = jest.mocked(manualAssign);
const mockRelease = jest.mocked(releaseOrder);
const mockCancel = jest.mocked(cancelOrder);
// The board panel this screen now embeds has its own two fetchers; they are stubbed empty here so
// these tests keep asserting on the roster and the queue rather than on the board.
const mockBoardCards = jest.mocked(fetchDeliveryCards);
const mockBoardCouriers = jest.mocked(fetchBoardCouriers);
const mockProofPhoto = jest.mocked(fetchOrderProofPhoto);

const COURIER: CourierStats = {
    courierId: "c1", name: "ali", status: "FREE",
    nearestBranchId: "b1", nearestBranchName: "Manama",
    accepted: 5, declined: 2, missed: 1, delivered: 4,
};

// The engine's own count of what this rider is holding. Deliberately NOT COURIER.accepted minus
// COURIER.delivered (5 - 4 = 1): a cancelled or returned run has no deliveredAt, so the derived
// figure climbs permanently, and the two numbers are different here so a test can tell which one
// the panel used.
// name is null on purpose: DeliveryBoardPanel is embedded in the couriers view and reads the SAME
// endpoint, so a board row named "ali" would put that text on screen twice and every findByText
// for the roster would hit two nodes.
const BOARD_ROW: CourierBoardRow = {
    courierId: "c1", name: null, phone: null, status: "FREE", freeAt: null,
    rank: null, score: null, noOfferReason: null,
    declinedCount: 2, missedCount: 1, ordersInHand: 3,
    onShiftSince: null, positionFixedAt: null, positionStaleAfterMinutes: 10,
};

const ORDER: CourierOrderSummary = {
    orderId: 42, orderNo: 7, status: "Delivered", deliveredAt: "2026-08-08T10:00:00",
    waitTimeMinutes: 3, travelTimeMinutes: 12, geofenceWarning: false, geofenceDistanceM: 20,
    geofenceOverridden: null,
};

// Still in flight, so release and cancel are both legal on it — unlike ORDER, which is Delivered
// and which the server would answer 409 for (DispatcherService.CONCLUDED_STATUSES).
const LIVE_ORDER: CourierOrderSummary = {
    orderId: 43, orderNo: 8, status: "Out for delivery", deliveredAt: null,
    waitTimeMinutes: 2, travelTimeMinutes: null, geofenceWarning: null, geofenceDistanceM: null,
    geofenceOverridden: null,
};

const AWAITING: UnassignedOrder = {
    orderId: 99, orderNo: 12, status: "Kitchen Phase", branchId: "b1", branchName: "Manama",
    addressLine: "Block 338, Road 3801", waitingMinutes: 14,
};

const ROUTE: OrderRoute = {
    orderId: 42, orderNo: 7, waitTimeMinutes: 3, travelTimeMinutes: 12, serviceTimeMinutes: null,
    geofenceWarning: false, geofenceDistanceM: 20, geofenceOverridden: null,
    destination: { latitude: 26.2285, longitude: 50.586, recordedAt: null },
    pickup: null,
    points: [{ latitude: 26.22, longitude: 50.58, recordedAt: "2026-08-08T09:55:00" }],
};

beforeEach(() => {
    // Mirrors the real contract: connectSocket runs the listener and hands back an unregister.
    // Without the return value the board hook's cleanup throws on unmount.
    mockConnectSocket.mockImplementation((onConnect: () => void) => {
        onConnect();
        return jest.fn<void, []>();
    });
    // StompSubscription also carries an id; the hook only ever calls unsubscribe.
    mockSubscribe.mockReturnValue({ id: "sub-1", unsubscribe: jest.fn<void, []>() });
    mockCouriers.mockReset();
    mockOrders.mockReset();
    mockRoute.mockReset();
    mockCouriers.mockResolvedValue([COURIER]);
    mockOrders.mockResolvedValue([ORDER]);
    mockRoute.mockResolvedValue(ROUTE);
    mockAwaiting.mockReset();
    mockAssign.mockReset();
    // Empty is the normal state; the tests that care opt in.
    mockAwaiting.mockResolvedValue([]);
    mockAssign.mockResolvedValue(undefined);
    mockRelease.mockReset();
    mockCancel.mockReset();
    mockRelease.mockResolvedValue(undefined);
    mockCancel.mockResolvedValue(undefined);
    mockBoardCards.mockReset();
    mockBoardCouriers.mockReset();
    mockBoardCards.mockResolvedValue([]);
    mockBoardCouriers.mockResolvedValue([BOARD_ROW]);
    mockProofPhoto.mockReset();
    mockProofPhoto.mockResolvedValue(null);
    // No key is the default in test and in any environment that never configured one.
    mockMapsKey.value = undefined;
});

describe("CourierDispatcherPanel", () => {
    /**
     * The roster row carries THREE numbers: delivered, in progress, missed. "Taken" is equal to
     * delivered by construction whenever every accepted order gets delivered, so the pair read as
     * noise, and a lifetime declined count says nothing about any period — both live in the
     * per-courier panel instead, where a date range makes them mean something.
     */
    it("shows delivered, in progress and missed on the roster row, and neither taken nor declined", async () => {
        render(<CourierDispatcherPanel />);

        expect(await screen.findByText("ali")).toBeTruthy();
        const row = screen.getByText(/4 delivered/);
        // One line, so all three read off the same node: a regression that splits them apart or
        // drops one of them fails here rather than passing on three separate lookups.
        expect(row.textContent).toBe("4 delivered · 3 in progress · 1 missed");
        // The exact shape the roster used to print for the two that left. The board panel above
        // it renders its own "Declined"/"Missed" labels in separate nodes from their values, so
        // it cannot produce either of these and cannot mask a regression here.
        expect(screen.queryByText(/\d+ taken/)).toBeNull();
        expect(screen.queryByText(/\d+ declined/)).toBeNull();
    });

    /**
     * "In progress" comes from the board roster, never from `accepted - delivered` off
     * CourierStats: that counts every order ever assigned, so a cancelled or returned run — which
     * has no deliveredAt — would keep inflating it forever. COURIER makes the two disagree on
     * purpose (5 - 4 = 1 derived, 3 reported), so this fails the moment anyone re-derives it.
     */
    it("reads orders in progress from the board roster rather than deriving accepted minus delivered", async () => {
        render(<CourierDispatcherPanel />);

        expect(await screen.findByText(/3 in progress/)).toBeTruthy();
        expect(screen.queryByText(/1 in progress/)).toBeNull();
    });

    /**
     * Admin item 1: on a phone the row could only give in one direction — the name column
     * truncated while the nowrap stats string held its full width. It now stacks below `sm` and
     * is untouched above it.
     *
     * Asserted on the exported tokens, not on the rendered node. Two things rule the DOM out
     * here: this repo wires no jest-dom matchers at all, and `window.getComputedStyle` on the
     * rendered row comes back EMPTY — jsdom does not resolve the rules emotion injects — so a DOM
     * assertion would either be vacuous or fail for the wrong reason. The tokens are what the
     * breakpoint CSS is generated from, and they are what the roster and the queue both consume.
     */
    it("stacks the roster row on a phone and keeps the single line from sm upwards", async () => {
        render(<CourierDispatcherPanel />);

        const row = (await screen.findByTestId("courier-stats-c1")).parentElement as HTMLElement;
        const rules = emotionRulesFor(row);

        expect(rules).toContain("@media (min-width:0px)");
        expect(rules).toContain("flex-direction:column");
        expect(rules).toContain("align-items:stretch");
        // Unchanged above sm: the owner's complaint was about a handset, and a desktop dispatcher
        // reads the roster far faster as one line per courier.
        expect(rules).toContain("@media (min-width:600px)");
        expect(rules).toContain("flex-direction:row");
        expect(rules).toContain("align-items:center");
    });

    /**
     * The stats string is the node that carried the unconditional nowrap, so the wrapping token
     * has to be on THAT node — not merely exported. Reads the class list rather than the computed
     * style, which jsdom leaves empty for emotion rules.
     */
    it("applies the wrapping token to the roster's own stats string", async () => {
        render(<CourierDispatcherPanel />);

        const rules = emotionRulesFor(await screen.findByTestId("courier-stats-c1"));

        // Wraps on a phone, still one line on a desktop row. The unconditional nowrap this
        // replaced is what forced the name column to truncate instead.
        expect(rules).toContain("@media (min-width:0px)");
        expect(rules).toContain("white-space:normal");
        expect(rules).toContain("@media (min-width:600px)");
        expect(rules).toContain("white-space:nowrap");
    });

    /** §4 is a drill-down: couriers → that courier's orders → one order's route. */
    it("drills from a courier into their orders and then into one route", async () => {
        render(<CourierDispatcherPanel />);

        fireEvent.click(await screen.findByText("ali"));
        expect(await screen.findByText("#7")).toBeTruthy();
        await waitFor(() => expect(mockOrders).toHaveBeenCalledWith("c1"));

        fireEvent.click(screen.getByText("#7"));
        await waitFor(() => expect(mockRoute).toHaveBeenCalledWith(42));
        expect(await screen.findByText(/Route \(1 points\)/)).toBeTruthy();
    });

    /**
     * The backend returns null — not zero — when a timing cannot be derived. Rendering "0 min"
     * would read as an instant handover and quietly misreport the §8 metrics.
     */
    it("renders an undecidable timing as a dash rather than zero", async () => {
        render(<CourierDispatcherPanel />);
        fireEvent.click(await screen.findByText("ali"));
        fireEvent.click(await screen.findByText("#7"));

        // Read the dash out of the metric it belongs to. `getAllByText("—").length > 0` does not
        // tie the dash to the field under test — the route view prints several — so it would pass
        // even with "At the door" showing 0 min beside somebody else's dash.
        const label = await screen.findByText("At the door");
        expect(label.nextElementSibling?.textContent).toBe("—");
        expect(screen.queryByText("0 min")).toBeNull();
    });

    /** The same field with a real number, so the dash above is a decision and not the only path. */
    it("renders a derivable timing as minutes", async () => {
        mockRoute.mockResolvedValue({ ...ROUTE, serviceTimeMinutes: 3 });
        render(<CourierDispatcherPanel />);
        fireEvent.click(await screen.findByText("ali"));
        fireEvent.click(await screen.findByText("#7"));

        const label = await screen.findByText("At the door");
        expect(label.nextElementSibling?.textContent).toBe("3 min");
    });

    /**
     * The override is only readable NEXT TO the distance, never instead of it: a drop-off logged
     * 180 m out can be GPS drift among buildings, but the same 180 m the rider had to push past
     * by hand is the rider asserting they were there. Two notices, not one merged sentence.
     */
    it("reports a geofence override alongside the distance, not in place of it", async () => {
        mockRoute.mockResolvedValue({
            ...ROUTE, geofenceWarning: true, geofenceDistanceM: 180, geofenceOverridden: true,
        });
        render(<CourierDispatcherPanel />);
        fireEvent.click(await screen.findByText("ali"));
        fireEvent.click(await screen.findByText("#7"));

        expect(await screen.findByText(/180 m from the customer's pin/)).toBeTruthy();
        expect(screen.getByText(/overrode the check/)).toBeTruthy();
    });

    /** A flagged distance the rider did NOT override must not accuse them of overriding it. */
    it("says nothing about an override when the rider did not make one", async () => {
        mockRoute.mockResolvedValue({
            ...ROUTE, geofenceWarning: true, geofenceDistanceM: 180, geofenceOverridden: false,
        });
        render(<CourierDispatcherPanel />);
        fireEvent.click(await screen.findByText("ali"));
        fireEvent.click(await screen.findByText("#7"));

        expect(await screen.findByText(/180 m from the customer's pin/)).toBeTruthy();
        expect(screen.queryByText(/overrode the check/)).toBeNull();
    });

    /**
     * The photo answers "the customer says it never arrived, where was it left?", which is asked
     * about orders nothing was ever flagged on — so it is offered on every route, and fetched
     * only when it is actually opened.
     */
    it("fetches the proof photo only once the manager opens it", async () => {
        render(<CourierDispatcherPanel />);
        fireEvent.click(await screen.findByText("ali"));
        fireEvent.click(await screen.findByText("#7"));

        const button = await screen.findByRole("button", { name: /Proof photo/ });
        expect(mockProofPhoto).not.toHaveBeenCalled();

        fireEvent.click(button);
        await waitFor(() => expect(mockProofPhoto).toHaveBeenCalledWith(42));
    });

    /** The stats panel belongs to the courier, so it is bound to the courier that was opened. */
    it("mounts the per-courier stats panel on the order list", async () => {
        render(<CourierDispatcherPanel />);
        fireEvent.click(await screen.findByText("ali"));

        // .textContent, not toHaveTextContent: jest-dom's matchers are not attached to
        // @jest/globals' expect in this repo.
        expect((await screen.findByTestId("courier-period-stats")).textContent).toBe("c1");
    });

    it("can navigate back up the drill-down", async () => {
        render(<CourierDispatcherPanel />);
        fireEvent.click(await screen.findByText("ali"));
        await screen.findByText("#7");

        fireEvent.click(screen.getByRole("button", { name: /back/i }));

        expect(await screen.findByText("Couriers")).toBeTruthy();
    });

    it("surfaces a failed request instead of rendering an empty table", async () => {
        mockCouriers.mockRejectedValue(new Error("Response: 403"));
        render(<CourierDispatcherPanel />);

        expect(await screen.findByText(/Response: 403/)).toBeTruthy();
    });

    /**
     * §2.3: an order nobody accepted is not cancelled and does not fall back to Keeta — the
     * customer has already paid — so it waits for a manager. Without this queue on screen, the
     * assign endpoint has no discoverable target.
     */
    it("lists orders waiting for a courier, oldest wait visible", async () => {
        mockAwaiting.mockResolvedValue([AWAITING]);

        render(<CourierDispatcherPanel />);

        expect(await screen.findByText("Waiting for a courier")).toBeTruthy();
        // Branch and address share one line now, so match the address within it.
        expect(screen.getByText(/Block 338, Road 3801/)).toBeTruthy();
        expect(screen.getByText("14 min")).toBeTruthy();
    });

    /** The queue is normally empty, and an empty table would just be noise on the board. */
    it("hides the queue entirely when nothing is waiting", async () => {
        render(<CourierDispatcherPanel />);

        expect(await screen.findByText("ali")).toBeTruthy();
        expect(screen.queryByText("Waiting for a courier")).toBeNull();
    });

    it("assigns the picked courier to the waiting order", async () => {
        mockAwaiting.mockResolvedValue([AWAITING]);

        render(<CourierDispatcherPanel />);

        fireEvent.click(await screen.findByText("Assign"));
        fireEvent.click(await screen.findByLabelText("ali"));
        fireEvent.click(screen.getByRole("button", { name: "Assign" }));

        await waitFor(() => expect(mockAssign).toHaveBeenCalledWith(99, "c1"));
    });

    /**
     * A courier can accept the pending offer — or another manager can assign — between this list
     * being drawn and the button being pressed. The server answers 409 rather than reassigning,
     * and the manager has to see that instead of believing the order moved.
     */
    it("surfaces the conflict when someone else took the order first", async () => {
        mockAwaiting.mockResolvedValue([AWAITING]);
        mockAssign.mockRejectedValue(new Error("Response: 409"));

        render(<CourierDispatcherPanel />);

        fireEvent.click(await screen.findByText("Assign"));
        fireEvent.click(await screen.findByLabelText("ali"));
        fireEvent.click(screen.getByRole("button", { name: "Assign" }));

        expect(await screen.findByText(/409/)).toBeTruthy();
    });

    /** The server rejects an offline rider with a 409, so it must not be offered as a choice. */
    it("does not offer couriers the server would refuse", async () => {
        mockAwaiting.mockResolvedValue([AWAITING]);
        mockCouriers.mockResolvedValue([COURIER, { ...COURIER, courierId: "c2", name: "sara", status: "OFFLINE" }]);

        render(<CourierDispatcherPanel />);

        fireEvent.click(await screen.findByText("Assign"));

        expect(await screen.findByLabelText("ali")).toBeTruthy();
        expect(screen.queryByLabelText("sara")).toBeNull();
    });
});
/**
 * The board used to be a snapshot from the moment it opened: an order that fell out of automatic
 * assignment appeared only if someone thought to reload — during exactly the minutes it matters.
 */
describe("CourierDispatcherPanel — live updates", () => {
    it("subscribes to the cross-branch delivery topic", async () => {
        render(<CourierDispatcherPanel />);

        await screen.findByText("ali");
        expect(mockSubscribe).toHaveBeenCalledWith("/topic/delivery-board", expect.any(Function));
    });

    it("refetches the view when the board signals a change", async () => {
        render(<CourierDispatcherPanel />);
        await screen.findByText("ali");

        const callsBefore = mockCouriers.mock.calls.length;
        // Two components on this screen subscribe to the topic now — this panel and the board it
        // embeds — and a real frame reaches both, so the test fires every registered handler
        // rather than whichever one happened to register first.
        const handlers = mockSubscribe.mock.calls
            .filter((call) => call[0] === "/topic/delivery-board")
            .map((call) => call[1] as (frame: unknown) => void);

        await act(async () => { handlers.forEach((handler) => handler({})); });

        await waitFor(() => expect(mockCouriers.mock.calls.length).toBeGreaterThan(callsBefore));
    });
});

/**
 * G1: the delivery design keeps saying "the manager sorts it out" — a rider goes offline mid-run,
 * a phone dies, a bike breaks — but nothing on this screen could take an order back off a courier,
 * so it stayed locked to them forever. Both endpoints existed on the backend and were never called.
 */
describe("CourierDispatcherPanel — release and cancel", () => {
    async function openCourierOrders(): Promise<void> {
        mockOrders.mockResolvedValue([LIVE_ORDER]);
        render(<CourierDispatcherPanel />);
        fireEvent.click(await screen.findByText("ali"));
        await screen.findByText("#8");
    }

    it("does not release the order until the manager confirms", async () => {
        await openCourierOrders();

        fireEvent.click(screen.getByRole("button", { name: "Release" }));

        expect(mockRelease).not.toHaveBeenCalled();
    });

    it("releases the order once confirmed and refetches the courier's list", async () => {
        await openCourierOrders();

        fireEvent.click(screen.getByRole("button", { name: "Release" }));
        const callsBefore = mockOrders.mock.calls.length;
        fireEvent.click(await screen.findByRole("button", { name: "Release order" }));

        await waitFor(() => expect(mockRelease).toHaveBeenCalledWith(43));
        await waitFor(() => expect(mockOrders.mock.calls.length).toBeGreaterThan(callsBefore));
    });

    /**
     * Realistic race: the courier can deliver the order, or another manager can act on it, between
     * this row being drawn and the button being pressed. The server answers 409 and the manager
     * has to see that rather than believe the order moved — same handling as manualAssign.
     */
    it("surfaces the failure instead of pretending the release worked", async () => {
        await openCourierOrders();
        mockRelease.mockRejectedValue(new Error("Response: 409"));

        fireEvent.click(screen.getByRole("button", { name: "Release" }));
        fireEvent.click(await screen.findByRole("button", { name: "Release order" }));

        expect(await screen.findByText(/Response: 409/)).toBeTruthy();
    });

    it("does not cancel the order until the manager confirms", async () => {
        await openCourierOrders();

        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

        expect(mockCancel).not.toHaveBeenCalled();
    });

    /**
     * There is no refund code anywhere in this system — a manager refunds by hand in the EazyPay
     * console (DispatcherService.cancel). A bare "Cancel this order?" would let a manager believe
     * the customer is paid back automatically, so the dialog has to say otherwise in plain words.
     */
    it("warns in plain words that no money goes back to the customer", async () => {
        await openCourierOrders();

        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

        expect(await screen.findByText(/No money is returned to the customer/)).toBeTruthy();
        expect(screen.getByText(/EazyPay console/)).toBeTruthy();
    });

    it("cancels the order once confirmed", async () => {
        await openCourierOrders();

        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
        fireEvent.click(await screen.findByRole("button", { name: "Cancel order" }));

        await waitFor(() => expect(mockCancel).toHaveBeenCalledWith(43));
    });

    it("surfaces a failed cancel", async () => {
        await openCourierOrders();
        mockCancel.mockRejectedValue(new Error("Response: 409"));

        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
        fireEvent.click(await screen.findByRole("button", { name: "Cancel order" }));

        expect(await screen.findByText(/Response: 409/)).toBeTruthy();
    });

    /** The server refuses a concluded order, so a button that can only 409 is not offered. */
    it("offers neither action on an order that has already concluded", async () => {
        render(<CourierDispatcherPanel />);
        fireEvent.click(await screen.findByText("ali"));
        await screen.findByText("#7");

        expect(screen.queryByRole("button", { name: "Release" })).toBeNull();
        expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    });

    /** The row itself drills into the route; a destructive tap must not also navigate. */
    it("does not drill into the route when the action button is pressed", async () => {
        await openCourierOrders();

        fireEvent.click(screen.getByRole("button", { name: "Release" }));

        expect(mockRoute).not.toHaveBeenCalled();
    });
});

/**
 * The drill-down used to print the courier's trail as a list of raw coordinates — "no admin is
 * going to reconstruct a route from numbers". §4's Mapbox token never arrived, so the trail is
 * drawn on the Google loader this frontend already runs, with the list kept as the no-key
 * fallback rather than a blank space.
 */
describe("CourierDispatcherPanel — route rendering", () => {
    async function openRoute(): Promise<void> {
        render(<CourierDispatcherPanel />);
        fireEvent.click(await screen.findByText("ali"));
        fireEvent.click(await screen.findByText("#7"));
        await screen.findByText(/Route \(/);
    }

    it("draws the trail on a map when a Maps key is configured", async () => {
        mockMapsKey.value = "test-key";

        await openRoute();

        expect(screen.getByTestId("order-route-map")).toBeTruthy();
        // The coordinate list is replaced by the map, not stacked underneath it.
        expect(screen.queryByText(/26\.22000, 50\.58000/)).toBeNull();
    });

    /** No key means no map at all, so the list is the fallback — never an empty panel. */
    it("keeps the coordinate list when no Maps key is configured", async () => {
        await openRoute();

        expect(screen.queryByTestId("order-route-map")).toBeNull();
        expect(screen.getByText("26.22000, 50.58000")).toBeTruthy();
    });

    /**
     * recordedAt is a UTC instant carrying a `Z`, unlike the naive Bahrain-local stamps everywhere
     * else in delivery. formatBahrainClock parses it through toEpochMsBahrain, which detects the
     * offset instead of appending one — so 09:55Z reads as 12:55, never 09:55 or 15:55, and never
     * as the raw ISO string the list used to print.
     */
    it("renders a UTC recordedAt as Bahrain wall-clock rather than a raw ISO string", async () => {
        mockRoute.mockResolvedValue({
            ...ROUTE,
            points: [{ latitude: 26.22, longitude: 50.58, recordedAt: "2026-08-08T09:55:00Z" }],
        });

        await openRoute();

        expect(screen.getByText("12:55")).toBeTruthy();
        expect(screen.queryByText("2026-08-08T09:55:00Z")).toBeNull();
        expect(screen.queryByText("15:55")).toBeNull();
    });

    /**
     * A courier whose phone never reported leaves no trail. That is a real failure and has to read
     * as one; an empty panel would look like a route that simply had nothing interesting in it.
     */
    it("says no samples were recorded when the trail is empty", async () => {
        mockRoute.mockResolvedValue({ ...ROUTE, points: [] });

        await openRoute();

        expect(screen.getByText(/No GPS samples recorded/)).toBeTruthy();
    });
});

/**
 * Who the roster lists.
 *
 * It listed every courier ever registered, forever — so the panel a manager reads mid-rush got one
 * row longer every time somebody was hired, and never shorter. The question it answers is "who is
 * working"; the payroll is a different question, and the switch is how to ask it.
 */
describe("CourierDispatcherPanel — the roster filter", () => {
    it("asks only for couriers who can be given work", async () => {
        render(<CourierDispatcherPanel />);

        await waitFor(() => expect(mockCouriers).toHaveBeenCalled());
        expect(mockCouriers).toHaveBeenCalledWith(false);
    });

    it("asks for everyone once the manager turns the switch on", async () => {
        render(<CourierDispatcherPanel />);
        await waitFor(() => expect(mockCouriers).toHaveBeenCalled());

        fireEvent.click(screen.getByLabelText("Show off shift"));

        await waitFor(() => expect(mockCouriers).toHaveBeenCalledWith(true));
    });

    /**
     * An empty roster now has two meanings, and they need different sentences: nobody has ever
     * signed in, or nobody is on shift right now. Printing the first when the second is true sends
     * a manager looking for a bug in the app.
     */
    it("says nobody is on shift rather than nobody exists", async () => {
        mockCouriers.mockResolvedValue([]);

        render(<CourierDispatcherPanel />);

        await waitFor(() => expect(screen.getByText(/Nobody is on shift right now/)).toBeTruthy());
    });

    it("says nobody has signed in when everyone was asked for", async () => {
        mockCouriers.mockResolvedValue([]);
        render(<CourierDispatcherPanel />);
        await waitFor(() => expect(mockCouriers).toHaveBeenCalled());

        fireEvent.click(screen.getByLabelText("Show off shift"));

        await waitFor(() =>
            expect(screen.getByText(/No couriers have signed in yet/)).toBeTruthy()
        );
    });
});
