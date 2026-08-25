import { jest, describe, it, expect, beforeEach, beforeAll } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { CourierDispatcherPanel } from "./CourierDispatcherPanel";
import {
    fetchCouriers, fetchCourierOrders, fetchOrderRoute, fetchOrdersAwaitingCourier, manualAssign,
} from "../../../../shared/api/dispatcher";
import type { CourierOrderSummary, CourierStats, OrderRoute, UnassignedOrder } from "../types";
import { connectSocket, socket } from "../../../../shared/api/socket";

jest.mock("../../../../shared/api/socket");
jest.mock("../../../../shared/api/dispatcher");

beforeAll(() => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
});

const mockCouriers = jest.mocked(fetchCouriers);
const mockOrders = jest.mocked(fetchCourierOrders);
const mockRoute = jest.mocked(fetchOrderRoute);
const mockConnectSocket = jest.mocked(connectSocket);
const mockSubscribe = socket.subscribe as jest.Mock;
const mockAwaiting = jest.mocked(fetchOrdersAwaitingCourier);
const mockAssign = jest.mocked(manualAssign);

const COURIER: CourierStats = {
    courierId: "c1", name: "ali", status: "FREE",
    nearestBranchId: "b1", nearestBranchName: "Manama",
    accepted: 5, declined: 2, missed: 1, delivered: 4,
};

const ORDER: CourierOrderSummary = {
    orderId: 42, orderNo: 7, status: "Delivered", deliveredAt: "2026-08-08T10:00:00",
    waitTimeMinutes: 3, travelTimeMinutes: 12, geofenceWarning: false, geofenceDistanceM: 20,
};

const AWAITING: UnassignedOrder = {
    orderId: 99, orderNo: 12, status: "Kitchen Phase", branchId: "b1", branchName: "Manama",
    addressLine: "Block 338, Road 3801", waitingMinutes: 14,
};

const ROUTE: OrderRoute = {
    orderId: 42, orderNo: 7, waitTimeMinutes: 3, travelTimeMinutes: 12, serviceTimeMinutes: null,
    geofenceWarning: false, geofenceDistanceM: 20,
    destination: { latitude: 26.2285, longitude: 50.586, recordedAt: null },
    points: [{ latitude: 26.22, longitude: 50.58, recordedAt: "2026-08-08T09:55:00" }],
};

beforeEach(() => {
    // Mirrors the real contract: connectSocket runs the listener and hands back an unregister.
    // Without the return value the board hook's cleanup throws on unmount.
    mockConnectSocket.mockImplementation((onConnect: () => void) => {
        onConnect();
        return jest.fn<void, []>();
    });
    mockSubscribe.mockReturnValue({ unsubscribe: jest.fn() });
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
});

describe("CourierDispatcherPanel", () => {
    /**
     * A rider who declines is making a choice; one who never answers may have a dead phone.
     * §4 counts them separately, so the panel must show them as separate columns rather than
     * summing them into one "refused" figure.
     */
    // Declined and missed stay distinct numbers — see types.ts. The roster now reads them on one
    // line per courier rather than as separate table columns, so the assertion is on the values.
    it("shows declined and no-answer as separate counts", async () => {
        render(<CourierDispatcherPanel />);

        expect(await screen.findByText("ali")).toBeTruthy();
        expect(screen.getByText(/2 declined/)).toBeTruthy();
        expect(screen.getByText(/1 missed/)).toBeTruthy();
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

        expect(await screen.findByText("At the door")).toBeTruthy();
        expect(screen.getAllByText("—").length).toBeGreaterThan(0);
        expect(screen.queryByText("0 min")).toBeNull();
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
        const handler = mockSubscribe.mock.calls.find(
            (call) => call[0] === "/topic/delivery-board"
        )?.[1] as (frame: unknown) => void;

        await act(async () => { handler({}); });

        await waitFor(() => expect(mockCouriers.mock.calls.length).toBeGreaterThan(callsBefore));
    });
});
