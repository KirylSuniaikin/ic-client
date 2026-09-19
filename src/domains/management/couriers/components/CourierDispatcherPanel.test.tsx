import { jest, describe, it, expect, beforeEach, beforeAll } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { CourierDispatcherPanel } from "./CourierDispatcherPanel";
import {
    cancelOrder, fetchBoardCouriers, fetchCouriers, fetchCourierOrders, fetchDeliveryCards,
    fetchOrderProofPhoto, fetchOrderRoute, fetchOrdersAwaitingCourier, fetchPartProofPhoto,
    manualAssign, manualAssignPart, releaseOrder, releasePart,
} from "../../../../shared/api/dispatcher";
import type {
    CourierBoardRow, CourierOrderSummary, CourierStats, DeliveryCard, OrderRoute, UnassignedOrder,
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
const mockAssignPart = jest.mocked(manualAssignPart);
const mockRelease = jest.mocked(releaseOrder);
const mockReleasePart = jest.mocked(releasePart);
const mockCancel = jest.mocked(cancelOrder);
const mockPartProofPhoto = jest.mocked(fetchPartProofPhoto);
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
    partId: 501, partIndex: 1, partsTotal: 1,
};

// Still in flight, so release and cancel are both legal on it — unlike ORDER, which is Delivered
// and which the server would answer 409 for (DispatcherService.CONCLUDED_STATUSES).
const LIVE_ORDER: CourierOrderSummary = {
    orderId: 43, orderNo: 8, status: "Out for delivery", deliveredAt: null,
    waitTimeMinutes: 2, travelTimeMinutes: null, geofenceWarning: null, geofenceDistanceM: null,
    geofenceOverridden: null,
    partId: 502, partIndex: 1, partsTotal: 1,
};

const AWAITING: UnassignedOrder = {
    orderId: 99, orderNo: 12, status: "Kitchen Phase", branchId: "b1", branchName: "Manama",
    addressLine: "Block 338, Road 3801", waitingMinutes: 14,
    pizzaCount: 3, couriersNeeded: 1, oversized: false,
    partId: 991, partIndex: 1, partsTotal: 1,
};

/** One rider cannot physically carry this — the automatic engine never offered it. */
const OVERSIZED_AWAITING: UnassignedOrder = {
    ...AWAITING, orderId: 100, orderNo: 13, pizzaCount: 17, couriersNeeded: 3, oversized: true,
    partId: 1001,
};

/**
 * An order live on the board's own "in flight" panel (`DeliveryBoardPanel`), still on the server's
 * awaiting-courier list — orderId/orderNo deliberately distinct from every other fixture in this
 * file so its card text ("#55") cannot collide with the waiting-queue row for the same order or
 * with any other rendered order number.
 */
const BOARD_AWAITING: UnassignedOrder = {
    orderId: 200, orderNo: 55, status: "Ready", branchId: "b1", branchName: "Manama",
    addressLine: "Block 900, Road 1", waitingMinutes: 9,
    pizzaCount: 3, couriersNeeded: 1, oversized: false,
    partId: 2001, partIndex: 1, partsTotal: 1,
};

const BOARD_CARD: DeliveryCard = {
    orderId: 200, orderNo: 55, status: "Ready",
    branchId: "b1", branchName: "Manama", addressLine: "Block 900, Road 1",
    customerName: "Zainab", customerPhone: "33009911", courierPhone: null,
    readyAt: null, estimatedHandoverAt: null, estimatedDeliveredAt: null, riskMinutes: null,
    promisedAt: null, promisedTotalMinutes: null, freshnessBudgetMinutes: null,
    items: [],
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
    mockAssignPart.mockReset();
    // Empty is the normal state; the tests that care opt in.
    mockAwaiting.mockResolvedValue([]);
    mockAssign.mockResolvedValue({ assigned: true, warning: null });
    mockAssignPart.mockResolvedValue({ assigned: true, warning: null });
    mockRelease.mockReset();
    mockReleasePart.mockReset();
    mockCancel.mockReset();
    mockRelease.mockResolvedValue(undefined);
    mockReleasePart.mockResolvedValue(undefined);
    mockCancel.mockResolvedValue(undefined);
    mockBoardCards.mockReset();
    mockBoardCouriers.mockReset();
    mockBoardCards.mockResolvedValue([]);
    mockBoardCouriers.mockResolvedValue([BOARD_ROW]);
    mockProofPhoto.mockReset();
    mockProofPhoto.mockResolvedValue(null);
    mockPartProofPhoto.mockReset();
    mockPartProofPhoto.mockResolvedValue(null);
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
     * Review iteration 2, Issue 1: the `withLoadingState` extraction moved `apply` outside the
     * wrapper's own try, so a throw from `apply` itself — not from the request — went through a
     * comment-only catch in `load()` and never reached `error` or `logger.error`. Every request
     * here resolves normally; only `applyCouriersView`'s `boardRows.map(...)` throws, because the
     * board endpoint answered with `null` instead of an array — a malformed payload, not a
     * rejected promise. If `apply` runs after `withLoadingState` again, this assertion times out
     * with the panel silently stuck on stale data instead of showing the failure.
     */
    it("surfaces an error when the board response is malformed and apply itself throws", async () => {
        mockBoardCouriers.mockResolvedValue(null as unknown as CourierBoardRow[]);
        render(<CourierDispatcherPanel />);

        expect(await screen.findByText(/map/)).toBeTruthy();
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

        // The first press is always unacknowledged — see the two-step flow in AssignCourierDialog.
        await waitFor(() => expect(mockAssign).toHaveBeenCalledWith(99, "c1", false));
    });

    /**
     * §4 of the courier-capacity brief: the automatic engine never offers an oversized order, so a
     * manager reading this queue needs to know BEFORE pressing Assign that one rider cannot carry
     * it — not discover it only after the manual-assign warning fires.
     */
    it("badges an oversized waiting order with how many couriers it needs", async () => {
        mockAwaiting.mockResolvedValue([AWAITING, OVERSIZED_AWAITING]);

        render(<CourierDispatcherPanel />);

        await screen.findByText("Waiting for a courier");
        expect(screen.getByText("Needs 3 couriers")).toBeTruthy();
    });

    /** A normal order carries no badge at all — not one reading "Needs 1 couriers". */
    it("shows no badge for a normal, non-oversized waiting order", async () => {
        mockAwaiting.mockResolvedValue([AWAITING]);

        render(<CourierDispatcherPanel />);

        await screen.findByText("Waiting for a courier");
        expect(screen.queryByText(/Needs \d+ couriers/)).toBeNull();
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
        // Issue 1 (review iteration 1): `findByText` above also matches text behind a still-open
        // dialog/backdrop — the dialog itself must actually close on a rejection, or the notice is
        // hidden and the manager can keep pressing into the same 409. This assertion fails if the
        // waiting-queue dialog's close-on-rejection wiring is removed.
        await waitFor(() => expect(screen.queryByRole("radio", { name: "ali" })).toBeNull());
        // The mount-site wrapper resolves the dialog's own promise with a benign
        // `{ assigned: false, warning: null }` fallback so the dialog's `handlePress` has something
        // to settle on. That fallback must never be readable as a real over-capacity warning — the
        // order is already gone (assertion above), so nothing should be left to show one on.
        expect(screen.queryByText(/already carrying/)).toBeNull();
    });

    /**
     * Server-authoritative two-step (courier-capacity, task-spec.md §5): `assigned: false` means
     * nothing changed server-side. Unlike a real conflict (409), this is a normal 200 the dialog
     * must survive — it must not close, and this panel must not refetch the queue/roster as if the
     * hand-over had happened, or the dialog would be showing a warning about state that just moved
     * out from under it.
     */
    it("keeps the waiting-queue dialog open and does not refetch when the server refuses over capacity", async () => {
        mockAwaiting.mockResolvedValue([AWAITING]);
        mockAssign.mockResolvedValue({
            assigned: false,
            warning: { riderPizzas: 6, orderPizzas: 4, totalPizzas: 10, capacity: 8 },
        });

        render(<CourierDispatcherPanel />);

        fireEvent.click(await screen.findByText("Assign"));
        fireEvent.click(await screen.findByLabelText("ali"));
        const awaitingCallsBefore = mockAwaiting.mock.calls.length;
        const couriersCallsBefore = mockCouriers.mock.calls.length;
        fireEvent.click(screen.getByRole("button", { name: "Assign" }));

        expect(await screen.findByRole("button", { name: "Assign anyway" })).toBeTruthy();
        expect(screen.getByText(/already carrying 6 pizza/)).toBeTruthy();
        // Still open: the picker (radiogroup) is still on screen, not replaced by the "couriers" view.
        expect(screen.getByRole("radio", { name: "ali" })).toBeTruthy();
        expect(mockAwaiting.mock.calls.length).toBe(awaitingCallsBefore);
        expect(mockCouriers.mock.calls.length).toBe(couriersCallsBefore);
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
 * Issue 1 (review iteration 1) named TWO mount sites: the waiting-queue dialog above (its own
 * `AssignCourierDialog`, opened straight off `CourierDispatcherPanel`) and the board's in-flight
 * card dialog, opened through the embedded `DeliveryBoardPanel`. `DeliveryBoardPanel.test.tsx`
 * proves that component's own close-on-reject wiring in isolation, against a bare mocked
 * `onAssign` — it never exercises the REAL `handleAssign`/`withLoadingState` this panel owns, so it
 * cannot prove the error a manager actually sees for this mount site. These tests mount the whole
 * panel with a live board card and drive a real rejection through it, the same way the
 * waiting-queue tests above do for their own mount site.
 */
describe("CourierDispatcherPanel — assign errors at the board mount site", () => {
    async function openBoardCard(): Promise<void> {
        mockAwaiting.mockResolvedValue([BOARD_AWAITING]);
        mockBoardCards.mockResolvedValue([BOARD_CARD]);
        render(<CourierDispatcherPanel />);

        // getByTestId, not getByText("#55"): the waiting-queue row for the SAME order prints the
        // identical "#55" label right above the board card, so a text query would be ambiguous —
        // this opens the board's own in-flight card specifically.
        fireEvent.click(await screen.findByTestId("delivery-card-200"));
        await screen.findByText("Why this order is with this rider and not another");
        fireEvent.click(await screen.findByRole("radio", { name: "ali" }));
    }

    it("surfaces the failure and closes the board popup when manualAssign rejects", async () => {
        mockAssign.mockRejectedValue(new Error("Response: 500"));
        await openBoardCard();

        fireEvent.click(screen.getByRole("button", { name: "Assign" }));

        // The same error notice the waiting-queue mount site surfaces — proving `withLoadingState`
        // reaches the panel's own `error` state regardless of which mount site called `handleAssign`.
        expect(await screen.findByText(/500/)).toBeTruthy();
        // And the popup itself must actually close, not sit open over an order that may have
        // already moved — this fails if DeliveryBoardPanel's own close-on-reject wiring, wired
        // through this panel's real `handleAssign`, is removed.
        await waitFor(() =>
            expect(screen.queryByText("Why this order is with this rider and not another")).toBeNull()
        );
    });

    /**
     * The mount-site wrapper resolves the dialog's promise with a benign
     * `{ assigned: false, warning: null }` fallback so `AssignCourierDialog.handlePress` has
     * something to settle on. Because the popup is already gone by the time that resolution lands,
     * nothing is left on screen for it to be misread as — neither a warning nor a quiet success.
     */
    it("never lets the benign rejection fallback read as a warning or a successful assignment", async () => {
        mockAssign.mockRejectedValue(new Error("Response: 500"));
        await openBoardCard();
        // Not `mockBoardCards`: `DeliveryBoardPanel` refetches its own cards on ANY popup close
        // (its `reload` is keyed on `openOrderId`), which would fire here regardless of outcome and
        // says nothing about whether the assignment was misread as successful. `fetchCouriers` /
        // `fetchOrdersAwaitingCourier` are the two calls `handleAssign` makes ONLY inside its own
        // `assigned: true` branch — the actual signal that a success was (wrongly) believed.
        const couriersCallsBefore = mockCouriers.mock.calls.length;
        const awaitingCallsBefore = mockAwaiting.mock.calls.length;

        fireEvent.click(screen.getByRole("button", { name: "Assign" }));
        await screen.findByText(/500/);

        expect(screen.queryByText(/already carrying/)).toBeNull();
        expect(screen.queryByRole("button", { name: "Assign anyway" })).toBeNull();
        expect(mockCouriers.mock.calls.length).toBe(couriersCallsBefore);
        expect(mockAwaiting.mock.calls.length).toBe(awaitingCallsBefore);
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

    /**
     * Courier-capacity Phase 5 (task-spec.md §11 P5): a genuinely split order's row releases
     * PART, not the whole order — releaseOrder would release a part that is not even the one on
     * screen once orders.assigned_courier_id stops being mirrored.
     */
    it("releases the part, not the order, for a genuinely split order's row", async () => {
        const splitLiveOrder = { ...LIVE_ORDER, partId: 4302, partIndex: 2, partsTotal: 2 };
        mockOrders.mockResolvedValue([splitLiveOrder]);
        render(<CourierDispatcherPanel />);
        fireEvent.click(await screen.findByText("ali"));
        await screen.findByText("#8");

        fireEvent.click(screen.getByRole("button", { name: "Release" }));
        fireEvent.click(await screen.findByRole("button", { name: "Release order" }));

        await waitFor(() => expect(mockReleasePart).toHaveBeenCalledWith(4302));
        expect(mockRelease).not.toHaveBeenCalled();
    });

    /** D6: cancel always stays wired to the whole order, regardless of which part's row it is pressed from. */
    it("cancels the whole order, never a single part, from a split order's own row", async () => {
        const splitLiveOrder = { ...LIVE_ORDER, partId: 4302, partIndex: 2, partsTotal: 2 };
        mockOrders.mockResolvedValue([splitLiveOrder]);
        render(<CourierDispatcherPanel />);
        fireEvent.click(await screen.findByText("ali"));
        await screen.findByText("#8");

        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
        fireEvent.click(await screen.findByRole("button", { name: "Cancel order" }));

        await waitFor(() => expect(mockCancel).toHaveBeenCalledWith(43));
    });

    /** D6: Cancel renders once per row, unaffected by which part it belongs to — never deduplicated across siblings. */
    it("renders one Cancel button per part row of the same split order", async () => {
        const part1: CourierOrderSummary = { ...LIVE_ORDER, partId: 4301, partIndex: 1, partsTotal: 2 };
        const part2: CourierOrderSummary = { ...LIVE_ORDER, partId: 4302, partIndex: 2, partsTotal: 2 };
        mockOrders.mockResolvedValue([part1, part2]);
        render(<CourierDispatcherPanel />);
        fireEvent.click(await screen.findByText("ali"));
        await screen.findByText("Part 1/2");

        expect(screen.getAllByRole("button", { name: "Cancel" })).toHaveLength(2);
    });
});

/**
 * Courier-capacity Phase 5 (task-spec.md §11 P5): the waiting-for-a-courier queue becomes
 * part-keyed — one row per still-unassigned part, routed to the correct assign endpoint.
 */
describe("CourierDispatcherPanel — split order queue (courier-capacity Phase 5)", () => {
    const SPLIT_PART_1_AWAITING: UnassignedOrder = {
        orderId: 300, orderNo: 30, status: "Ready", branchId: "b1", branchName: "Manama",
        addressLine: "Block 1, Road 1", waitingMinutes: 5,
        pizzaCount: 4, couriersNeeded: 1, oversized: false,
        partId: 3001, partIndex: 1, partsTotal: 2,
    };
    const SPLIT_PART_2_AWAITING: UnassignedOrder = {
        ...SPLIT_PART_1_AWAITING, partId: 3002, partIndex: 2,
    };

    it("renders one row per still-unassigned part, each with its own Part badge", async () => {
        mockAwaiting.mockResolvedValue([SPLIT_PART_1_AWAITING, SPLIT_PART_2_AWAITING]);

        render(<CourierDispatcherPanel />);

        await screen.findByText("Waiting for a courier");
        expect(screen.getByText("Part 1/2")).toBeTruthy();
        expect(screen.getByText("Part 2/2")).toBeTruthy();
        expect(screen.getAllByText("#30")).toHaveLength(2);
    });

    it("shows no Part badge for a non-split waiting order", async () => {
        mockAwaiting.mockResolvedValue([AWAITING]);

        render(<CourierDispatcherPanel />);

        await screen.findByText("Waiting for a courier");
        expect(screen.queryByText(/Part \d+\/\d+/)).toBeNull();
    });

    it("calls manualAssignPart, not manualAssign, when assigning a split order's part from the queue", async () => {
        mockAwaiting.mockResolvedValue([SPLIT_PART_1_AWAITING]);

        render(<CourierDispatcherPanel />);

        fireEvent.click(await screen.findByText("Assign"));
        fireEvent.click(await screen.findByLabelText("ali"));
        fireEvent.click(screen.getByRole("button", { name: "Assign" }));

        await waitFor(() => expect(mockAssignPart).toHaveBeenCalledWith(3001, "c1", false));
        expect(mockAssign).not.toHaveBeenCalled();
    });

    it("still calls manualAssign for a plain, non-split waiting order", async () => {
        mockAwaiting.mockResolvedValue([AWAITING]);

        render(<CourierDispatcherPanel />);

        fireEvent.click(await screen.findByText("Assign"));
        fireEvent.click(await screen.findByLabelText("ali"));
        fireEvent.click(screen.getByRole("button", { name: "Assign" }));

        await waitFor(() => expect(mockAssign).toHaveBeenCalledWith(99, "c1", false));
        expect(mockAssignPart).not.toHaveBeenCalled();
    });
});

/**
 * Courier-capacity Phase 5 (D5): the proof-photo viewer always targets the specific part the
 * manager drilled in from.
 */
describe("CourierDispatcherPanel — proof photo per part (courier-capacity Phase 5)", () => {
    it("fetches the part-keyed proof photo for a genuinely split order's route", async () => {
        const splitOrder: CourierOrderSummary = { ...ORDER, partId: 4201, partIndex: 2, partsTotal: 2 };
        mockOrders.mockResolvedValue([splitOrder]);
        render(<CourierDispatcherPanel />);
        fireEvent.click(await screen.findByText("ali"));
        fireEvent.click(await screen.findByText("#7"));

        const button = await screen.findByRole("button", { name: /Proof photo/ });
        fireEvent.click(button);

        await waitFor(() => expect(mockPartProofPhoto).toHaveBeenCalledWith(4201));
        expect(mockProofPhoto).not.toHaveBeenCalled();
    });

    it("still fetches the order-keyed proof photo for a plain, non-split order's route", async () => {
        render(<CourierDispatcherPanel />);
        fireEvent.click(await screen.findByText("ali"));
        fireEvent.click(await screen.findByText("#7"));

        const button = await screen.findByRole("button", { name: /Proof photo/ });
        fireEvent.click(button);

        await waitFor(() => expect(mockProofPhoto).toHaveBeenCalledWith(42));
        expect(mockPartProofPhoto).not.toHaveBeenCalled();
    });

    it("captions the route drill-down as whole-order when opened from a split order's row", async () => {
        const splitOrder: CourierOrderSummary = { ...ORDER, partId: 4201, partIndex: 2, partsTotal: 2 };
        mockOrders.mockResolvedValue([splitOrder]);
        render(<CourierDispatcherPanel />);
        fireEvent.click(await screen.findByText("ali"));
        fireEvent.click(await screen.findByText("#7"));

        expect(await screen.findByText(
            /Wait \/ Travel \/ GPS trail are for the whole order, not just this part/
        )).toBeTruthy();
    });

    it("shows no such caption for a plain, non-split order's route", async () => {
        render(<CourierDispatcherPanel />);
        fireEvent.click(await screen.findByText("ali"));
        fireEvent.click(await screen.findByText("#7"));

        await screen.findByText(/Route \(1 points\)/);
        expect(screen.queryByText(/Wait \/ Travel \/ GPS trail are for the whole order/)).toBeNull();
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
