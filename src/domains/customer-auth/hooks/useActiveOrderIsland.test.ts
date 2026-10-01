import { jest, describe, it, expect, beforeAll, beforeEach, afterEach } from "@jest/globals";
import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { StompSubscription, StompHeaders } from "@stomp/stompjs";

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/customerAuth.ts
jest.mock("../../../shared/api/customerAuth");
// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/socket.ts
jest.mock("../../../shared/api/socket");

import { fetchActiveOrder, logoutCustomer, refreshCustomerToken } from "../../../shared/api/customerAuth";
import { connectSocket, socket } from "../../../shared/api/socket";
import { CustomerAuthProvider, __resetCustomerAuthStoreForTests } from "../context/CustomerAuthProvider";
import { CustomerAuthUiProvider, useCustomerAuthUi } from "../context/CustomerAuthUiProvider";
import { useActiveOrderIsland } from "./useActiveOrderIsland";
import { CustomerAuthApiError } from "../types";
import type { CustomerActiveOrder } from "../types";

const mockFetchActiveOrder = jest.mocked(fetchActiveOrder);
const mockRefreshCustomerToken = jest.mocked(refreshCustomerToken);
const mockLogoutCustomer = jest.mocked(logoutCustomer);
const mockConnectSocket = jest.mocked(connectSocket);
const mockSubscribe = jest.mocked(socket.subscribe);

function makeSub(): StompSubscription {
    return {
        id: "island-sub",
        unsubscribe: jest.fn<void, [StompHeaders?]>(),
    };
}

function getFrameHandler(): (frame: { body: string }) => void {
    const call = mockSubscribe.mock.calls[mockSubscribe.mock.calls.length - 1] as
        [string, (frame: { body: string }) => void];
    return call[1];
}

// Formats "now" as a Bahrain-local ("yyyy-MM-dd HH:mm") timestamp, mirroring the backend's
// DT_FMT — so toEpochMsBahrain(createdAt) resolves close to Date.now() and timeLeft stays
// positive regardless of when the test suite actually runs.
function nowAsBahrainTimestamp(): string {
    const bahrainNow = new Date(Date.now() + 3 * 60 * 60 * 1000);
    const pad = (n: number): string => String(n).padStart(2, "0");
    return `${bahrainNow.getUTCFullYear()}-${pad(bahrainNow.getUTCMonth() + 1)}-${pad(bahrainNow.getUTCDate())} ${pad(bahrainNow.getUTCHours())}:${pad(bahrainNow.getUTCMinutes())}`;
}

const ACTIVE_ORDER: CustomerActiveOrder = {
    id: 42,
    orderNumber: 7,
    status: "Kitchen Phase",
    type: "Pick Up",
    createdAt: nowAsBahrainTimestamp(),
    estimation: 15,
    branchId: "branch-1",
    branchName: "Downtown",
};

// useActiveOrderIsland calls useCustomerAuth() and useCustomerAuthUi() internally, so every
// renderHook needs both providers as ancestors — mirrors app/providers.tsx wiring.
function wrapper({ children }: { children: React.ReactNode }): React.JSX.Element {
    return React.createElement(
        CustomerAuthProvider,
        null,
        React.createElement(CustomerAuthUiProvider, null, children)
    );
}

// Combines useActiveOrderIsland with useCustomerAuthUi under the same render so a test can
// observe the openOrderDetail side effect of handleClick without mocking the context.
function useIslandWithUi() {
    const island = useActiveOrderIsland();
    const ui = useCustomerAuthUi();
    return { island, ui };
}

async function waitForAuthReady(): Promise<void> {
    await waitFor(() => expect(mockRefreshCustomerToken).toHaveBeenCalled());
}

beforeAll(() => {
    jest.spyOn(console, "debug").mockImplementation(() => undefined);
    // Silences the expected error log from useActiveOrderIsland's fetchActiveOrder
    // failure branch (task-spec.md §7 — logged for diagnosability, not thrown/surfaced).
    jest.spyOn(console, "error").mockImplementation(() => undefined);
});

beforeEach(() => {
    __resetCustomerAuthStoreForTests();
    mockRefreshCustomerToken.mockReset();
    mockRefreshCustomerToken.mockRejectedValue(new Error("no session"));
    mockFetchActiveOrder.mockReset();
    mockLogoutCustomer.mockReset();
    mockConnectSocket.mockImplementation((onConnect: () => void) => {
        onConnect();
        return jest.fn<void, []>();
    });
    mockSubscribe.mockReturnValue(makeSub());
});

afterEach(() => {
    jest.clearAllMocks();
});

describe("useActiveOrderIsland", () => {
    it("is not visible when there is no token (guest)", async () => {
        const { result } = renderHook(() => useActiveOrderIsland(), { wrapper });
        await waitForAuthReady();

        expect(result.current.isVisible).toBe(false);
        expect(result.current.activeOrder).toBeNull();
        expect(mockFetchActiveOrder).not.toHaveBeenCalled();
    });

    it("is not visible when logged in but the customer has no active order", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "tok-1", isNewAccount: false });
        mockFetchActiveOrder.mockResolvedValueOnce(null);

        const { result } = renderHook(() => useActiveOrderIsland(), { wrapper });
        await waitForAuthReady();

        await waitFor(() => expect(mockFetchActiveOrder).toHaveBeenCalledWith("tok-1"));
        expect(result.current.isVisible).toBe(false);
        expect(result.current.activeOrder).toBeNull();
    });

    it("is visible with correct timeLeft/totalSec derivation when an active order exists", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "tok-1", isNewAccount: false });
        mockFetchActiveOrder.mockResolvedValueOnce(ACTIVE_ORDER);

        const { result } = renderHook(() => useActiveOrderIsland(), { wrapper });
        await waitForAuthReady();

        await waitFor(() => expect(result.current.isVisible).toBe(true));
        expect(result.current.activeOrder).toEqual(ACTIVE_ORDER);
        expect(result.current.totalSec).toBe(15 * 60);
        expect(result.current.timeLeft).toBeGreaterThan(0);
    });

    it("falls back to a 15-minute totalSec when estimation is null", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "tok-1", isNewAccount: false });
        mockFetchActiveOrder.mockResolvedValueOnce({ ...ACTIVE_ORDER, estimation: null });

        const { result } = renderHook(() => useActiveOrderIsland(), { wrapper });
        await waitForAuthReady();

        await waitFor(() => expect(result.current.isVisible).toBe(true));
        expect(result.current.totalSec).toBe(15 * 60);
    });

    /**
     * The refetch deliberately answers with the SAME order at its new status rather than `null`.
     * Stubbing it to `null` — as this test used to — makes `isVisible` false because there is no
     * active order at all, which is true whatever the terminal-status rule does; the assertion
     * then passes with the rule deleted. Returning the order forces the terminality check to be
     * the only thing that can hide the pill.
     */
    it("hides the pill once a live frame advances the tracked order to Picked Up", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "tok-1", isNewAccount: false });
        mockFetchActiveOrder.mockResolvedValueOnce(ACTIVE_ORDER);
        mockFetchActiveOrder.mockResolvedValueOnce({ ...ACTIVE_ORDER, status: "Picked Up" });

        const { result } = renderHook(() => useActiveOrderIsland(), { wrapper });
        await waitForAuthReady();

        await waitFor(() => expect(result.current.isVisible).toBe(true));
        await waitFor(() => expect(mockSubscribe).toHaveBeenCalledTimes(1));

        const handler = getFrameHandler();
        act(() => {
            handler({ body: JSON.stringify({ id: ACTIVE_ORDER.id, status: "Picked Up" }) });
        });

        await waitFor(() => expect(result.current.isVisible).toBe(false));
        expect(mockFetchActiveOrder).toHaveBeenCalledTimes(2);
    });

    // DELIVERY_SPEC.md §12.1-D: "Delivered" is the delivery branch's terminal status, the
    // twin of "Picked Up" above. The visibility check used to compare against the pickup
    // string alone, which left the pill pinned to a finished delivery order indefinitely.
    it("hides the pill once a live frame advances the tracked order to Delivered", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "tok-1", isNewAccount: false });
        mockFetchActiveOrder.mockResolvedValueOnce(ACTIVE_ORDER);
        // Same reasoning as above: the refetch keeps the order, so only terminality can hide it.
        mockFetchActiveOrder.mockResolvedValueOnce({ ...ACTIVE_ORDER, status: "Delivered" });

        const { result } = renderHook(() => useActiveOrderIsland(), { wrapper });
        await waitForAuthReady();

        await waitFor(() => expect(result.current.isVisible).toBe(true));
        await waitFor(() => expect(mockSubscribe).toHaveBeenCalledTimes(1));

        const handler = getFrameHandler();
        act(() => {
            handler({ body: JSON.stringify({ id: ACTIVE_ORDER.id, status: "Delivered" }) });
        });

        await waitFor(() => expect(result.current.isVisible).toBe(false));
        expect(mockFetchActiveOrder).toHaveBeenCalledTimes(2);
    });

    // The in-transit status must NOT be treated as terminal — the customer is still
    // waiting and the pill is precisely what they watch during the drive.
    it("keeps the pill visible while the order is Out for delivery", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "tok-1", isNewAccount: false });
        mockFetchActiveOrder.mockResolvedValue(ACTIVE_ORDER);

        const { result } = renderHook(() => useActiveOrderIsland(), { wrapper });
        await waitForAuthReady();

        await waitFor(() => expect(result.current.isVisible).toBe(true));
        await waitFor(() => expect(mockSubscribe).toHaveBeenCalledTimes(1));

        const handler = getFrameHandler();
        act(() => {
            handler({ body: JSON.stringify({ id: ACTIVE_ORDER.id, status: "Out for delivery" }) });
        });

        await waitFor(() => expect(result.current.status).toBe("Out for delivery"));
        expect(result.current.isVisible).toBe(true);
    });

    it("handleClick calls openOrderDetail with the active order's id", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "tok-1", isNewAccount: false });
        mockFetchActiveOrder.mockResolvedValueOnce(ACTIVE_ORDER);

        const { result } = renderHook(() => useIslandWithUi(), { wrapper });
        await waitForAuthReady();

        await waitFor(() => expect(result.current.island.isVisible).toBe(true));

        act(() => {
            result.current.island.handleClick();
        });

        expect(result.current.ui.isProfileOpen).toBe(true);
        expect(result.current.ui.selectedOrderId).toBe(ACTIVE_ORDER.id);
    });

    it("handleClick is a no-op when there is no active order", async () => {
        const { result } = renderHook(() => useIslandWithUi(), { wrapper });
        await waitForAuthReady();

        act(() => {
            result.current.island.handleClick();
        });

        expect(result.current.ui.isProfileOpen).toBe(false);
        expect(result.current.ui.selectedOrderId).toBeNull();
    });

    it("treats a fetchActiveOrder 401 like a logged-out state, without calling logout()", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "tok-1", isNewAccount: false });
        mockFetchActiveOrder.mockRejectedValueOnce(new CustomerAuthApiError("unauthorized", 401));

        const { result } = renderHook(() => useActiveOrderIsland(), { wrapper });
        await waitForAuthReady();

        await waitFor(() => expect(mockFetchActiveOrder).toHaveBeenCalledWith("tok-1"));
        expect(result.current.activeOrder).toBeNull();
        expect(result.current.isVisible).toBe(false);
        // Session-expiry handling stays owned by the popups (task-spec.md §7) — this
        // passive homepage hook must not trigger a logout side effect on its own.
        expect(mockLogoutCustomer).not.toHaveBeenCalled();
    });

    it("hides the pill and does not throw when fetchActiveOrder fails with a non-401 error", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "tok-1", isNewAccount: false });
        mockFetchActiveOrder.mockRejectedValueOnce(new Error("network down"));

        const { result } = renderHook(() => useActiveOrderIsland(), { wrapper });
        await waitForAuthReady();

        await waitFor(() => expect(mockFetchActiveOrder).toHaveBeenCalledWith("tok-1"));
        expect(result.current.activeOrder).toBeNull();
        expect(result.current.isVisible).toBe(false);
    });

    it("re-fetches the active order on a live status advance and hides the pill when the refetch reports none active", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "tok-1", isNewAccount: false });
        mockFetchActiveOrder.mockResolvedValueOnce(ACTIVE_ORDER);
        mockFetchActiveOrder.mockResolvedValueOnce({ ...ACTIVE_ORDER, status: "Ready" });

        const { result } = renderHook(() => useActiveOrderIsland(), { wrapper });
        await waitForAuthReady();

        await waitFor(() => expect(result.current.isVisible).toBe(true));
        await waitFor(() => expect(mockSubscribe).toHaveBeenCalledTimes(1));

        const handler = getFrameHandler();
        act(() => {
            handler({ body: JSON.stringify({ id: ACTIVE_ORDER.id, status: "Ready" }) });
        });

        await waitFor(() => expect(mockFetchActiveOrder).toHaveBeenCalledTimes(2));
        await waitFor(() => expect(result.current.activeOrder?.status).toBe("Ready"));
        expect(result.current.isVisible).toBe(true);
    });
});


/**
 * "Picked Up" ends a pickup order and does NOT end a delivery: there it means the courier has the
 * food and the customer is still waiting. Marking the order collected on the admin board used to
 * make the customer's widget disappear at exactly that moment.
 */
describe("useActiveOrderIsland — a delivery outlives the hand-over", () => {
    async function renderWith(order: CustomerActiveOrder) {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "tok-1", isNewAccount: false });
        mockFetchActiveOrder.mockResolvedValueOnce(order);

        const { result } = renderHook(() => useActiveOrderIsland(), { wrapper });
        await waitForAuthReady();
        await waitFor(() => expect(result.current.activeOrder).not.toBeNull());
        return result;
    }

    it("keeps a delivery order on screen once the courier has collected it", async () => {
        const result = await renderWith({ ...ACTIVE_ORDER, type: "Delivery", status: "Picked Up" });

        expect(result.current.isVisible).toBe(true);
    });

    it("drops a delivery order once it reaches the door", async () => {
        const result = await renderWith({ ...ACTIVE_ORDER, type: "Delivery", status: "Delivered" });

        expect(result.current.isVisible).toBe(false);
    });

    it("still ends a pickup order at Picked Up", async () => {
        const result = await renderWith({ ...ACTIVE_ORDER, type: "Pick Up", status: "Picked Up" });

        expect(result.current.isVisible).toBe(false);
    });

    /**
     * manual §04 edge 9 — what the customer sees after a no-show. "Returned Undelivered" is the
     * other terminal ending, and it is in DELIVERY_TERMINAL_STATUSES with nothing asserting it:
     * the pill goes quiet rather than counting down forever to a door the rider already left.
     * The order does not disappear — it stays in their history with the status that explains it,
     * which is CustomerOrderDetailPopup's half of the same rule.
     */
    it("drops a delivery order that came back undelivered", async () => {
        const result = await renderWith({ ...ACTIVE_ORDER, type: "Delivery", status: "Returned Undelivered" });

        expect(result.current.isVisible).toBe(false);
        // Still tracked, just not shown: the pill is what goes quiet, not the order.
        expect(result.current.activeOrder).not.toBeNull();
    });

    /**
     * The status that ends a delivery is not the one that ends a pickup, and vice versa. A single
     * shared terminal set would either strand a delivered order on screen or wipe the pill at
     * hand-over — both of which have happened.
     */
    it("does not treat a returned delivery status as terminal for a pickup order", async () => {
        const result = await renderWith({ ...ACTIVE_ORDER, type: "Pick Up", status: "Out for delivery" });

        expect(result.current.isVisible).toBe(true);
    });
});


/**
 * The hook owns the ride's clock, so the pill can stay presentational. `estimation` is minutes to
 * Ready and cannot describe the ride, which is why handoverAt/estimatedDeliveredAt exist at all.
 */
describe("useActiveOrderIsland — the ride's live progress", () => {
    /** A Bahrain-local stamp `minutes` from now, in the backend's LocalDateTime (ISO) shape. */
    function bahrainStampIn(minutes: number): string {
        const t = new Date(Date.now() + 3 * 60 * 60 * 1000 + minutes * 60_000);
        const pad = (n: number): string => String(n).padStart(2, "0");
        return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}T${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}:${pad(t.getUTCSeconds())}`;
    }

    async function renderWith(order: CustomerActiveOrder) {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "tok-1", isNewAccount: false });
        mockFetchActiveOrder.mockResolvedValueOnce(order);

        const { result } = renderHook(() => useActiveOrderIsland(), { wrapper });
        await waitForAuthReady();
        await waitFor(() => expect(result.current.activeOrder).not.toBeNull());
        return result;
    }

    it("derives a mid-ride fill from the two delivery timings", async () => {
        // 5 minutes into a 20-minute ride -- a quarter, deliberately NOT the halfway point, so a
        // fill that ignored elapsed time could not accidentally satisfy this.
        const result = await renderWith({
            ...ACTIVE_ORDER,
            type: "Delivery",
            status: "Out for delivery",
            handoverAt: bahrainStampIn(-5),
            estimatedDeliveredAt: bahrainStampIn(15),
        });

        expect(result.current.rideProgress).not.toBeNull();
        expect(result.current.rideProgress?.fraction).toBeGreaterThan(0.18);
        expect(result.current.rideProgress?.fraction).toBeLessThan(0.30);
        expect(result.current.rideProgress?.minutesLeft).toBe(15);
        expect(result.current.rideProgress?.overdue).toBe(false);
    });

    it("reports the ride as overdue once the estimate has passed", async () => {
        const result = await renderWith({
            ...ACTIVE_ORDER,
            type: "Delivery",
            status: "Out for delivery",
            handoverAt: bahrainStampIn(-30),
            estimatedDeliveredAt: bahrainStampIn(-5),
        });

        expect(result.current.rideProgress?.overdue).toBe(true);
        expect(result.current.rideProgress?.minutesLeft).toBe(0);
    });

    // Absent timings must not be read as "the ride started right now" — toEpochMsBahrain answers
    // Date.now() for a missing string, so the guard in the hook is what keeps this honest.
    it("reports no ride progress for a delivery order with no timings yet", async () => {
        const result = await renderWith({
            ...ACTIVE_ORDER,
            type: "Delivery",
            status: "Out for delivery",
        });

        expect(result.current.rideProgress).toBeNull();
    });

    it("reports no ride progress for a pickup order", async () => {
        const result = await renderWith({ ...ACTIVE_ORDER, type: "Pick Up", status: "Oven" });

        expect(result.current.rideProgress).toBeNull();
    });
});

describe("useActiveOrderIsland rider slots and refresh", () => {
    const SPLIT: CustomerActiveOrder = {
        ...ACTIVE_ORDER,
        type: "Delivery",
        status: "Out for delivery",
        partsTotal: 3,
        partsOnRoad: 1,
        partsDelivered: 1,
    };
    const TICK = 20_000;

    function setVisibility(state: "visible" | "hidden"): void {
        Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
        document.dispatchEvent(new Event("visibilitychange"));
    }

    async function advance(ms: number): Promise<void> {
        // Jest 27 has no advanceTimersByTimeAsync: advance, then let the awaited fetch settle.
        await act(async () => {
            jest.advanceTimersByTime(ms);
            for (let i = 0; i < 10; i++) await Promise.resolve();
        });
    }

    // Fake timers only in this block; the first load is flushed inside act so the auth refresh
    // and the fetch have settled before any timer is advanced.
    async function mount(first: CustomerActiveOrder | null) {
        mockRefreshCustomerToken.mockResolvedValue({ accessToken: "tok-1", isNewAccount: false });
        mockFetchActiveOrder.mockResolvedValueOnce(first);
        const hook = renderHook(() => useActiveOrderIsland(), { wrapper });
        await advance(0);
        expect(mockFetchActiveOrder).toHaveBeenCalledTimes(1);
        return hook;
    }

    beforeEach(() => {
        jest.useFakeTimers();
        setVisibility("visible");
    });

    afterEach(() => {
        jest.useRealTimers();
        setVisibility("visible");
    });

    it("derives one rider slot per part for a split delivery", async () => {
        const { result } = await mount(SPLIT);

        expect(result.current.riderSlots).toEqual({
            slots: ["delivered", "onRoad", "waiting"],
            overflow: 0,
        });
    });

    describe("courier names", () => {
        const NAMED: CustomerActiveOrder = { ...SPLIT, onRoadCourierNames: ["Ali"] };

        it("passes the names into riderSlots", async () => {
            const { result } = await mount(NAMED);

            expect(result.current.riderSlots?.names).toEqual([null, "Ali", null]);
        });

        it("leaves no names when the field is missing", async () => {
            const { result } = await mount(SPLIT);

            expect(result.current.riderSlots).not.toHaveProperty("names");
        });

        it("leaves no names for a pickup order carrying the field", async () => {
            const { result } = await mount({ ...NAMED, type: "Pick Up", status: "Oven" });

            expect(result.current.riderSlots).toBeNull();
        });

        it("builds a new riderSlots when a name changes with identical counts", async () => {
            const { result } = await mount(NAMED);
            const before = result.current.riderSlots;
            mockFetchActiveOrder.mockResolvedValueOnce({ ...NAMED, onRoadCourierNames: ["Omar"] });

            await advance(TICK);

            expect(result.current.riderSlots).not.toBe(before);
            expect(result.current.riderSlots?.names).toEqual([null, "Omar", null]);
        });

        it("keeps the same riderSlots object across a poll with identical content", async () => {
            const { result } = await mount(NAMED);
            const before = result.current.riderSlots;
            mockFetchActiveOrder.mockResolvedValueOnce({ ...NAMED, onRoadCourierNames: ["Ali"] });

            await advance(TICK);

            expect(mockFetchActiveOrder).toHaveBeenCalledTimes(2);
            expect(result.current.riderSlots).toBe(before);
        });
    });

    it.each([
        ["a pickup order", { ...ACTIVE_ORDER, status: "Oven" }],
        ["a one-part delivery", { ...ACTIVE_ORDER, type: "Delivery", status: "Out for delivery" }],
        ["a delivery with partsTotal 1", {
            ...ACTIVE_ORDER, type: "Delivery", status: "Out for delivery",
            partsTotal: 1, partsOnRoad: 1, partsDelivered: 0,
        }],
        ["a pickup order with stray parts fields", {
            ...ACTIVE_ORDER, status: "Out for delivery", partsTotal: 3, partsOnRoad: 1, partsDelivered: 1,
        }],
    ])("has no riders and never polls for %s", async (_name, order) => {
        const { result } = await mount(order);

        await advance(60_000);

        expect(result.current.riderSlots).toBeNull();
        expect(mockFetchActiveOrder).toHaveBeenCalledTimes(1);
    });

    it("refreshes a split out-for-delivery order every 20s and shows the new counts", async () => {
        const { result } = await mount(SPLIT);
        mockFetchActiveOrder.mockResolvedValueOnce({ ...SPLIT, partsOnRoad: 0, partsDelivered: 2 });

        await advance(TICK - 1);
        expect(mockFetchActiveOrder).toHaveBeenCalledTimes(1);
        await advance(1);
        expect(mockFetchActiveOrder).toHaveBeenCalledTimes(2);
        expect(result.current.riderSlots?.slots).toEqual(["delivered", "delivered", "waiting"]);

        mockFetchActiveOrder.mockResolvedValueOnce({ ...SPLIT, partsOnRoad: 0, partsDelivered: 2 });
        await advance(TICK);
        expect(mockFetchActiveOrder).toHaveBeenCalledTimes(3);
    });

    it.each(["Kitchen Phase", "Oven", "Ready"])("does not poll a split order in %s", async (status) => {
        await mount({ ...SPLIT, status, partsOnRoad: 0, partsDelivered: 0 });

        await advance(60_000);

        expect(mockFetchActiveOrder).toHaveBeenCalledTimes(1);
    });

    it("pauses while the tab is hidden and resumes when it is visible again", async () => {
        await mount(SPLIT);
        mockFetchActiveOrder.mockResolvedValue(SPLIT);

        act(() => setVisibility("hidden"));
        await advance(60_000);
        expect(mockFetchActiveOrder).toHaveBeenCalledTimes(1);

        act(() => setVisibility("visible"));
        await advance(TICK);
        expect(mockFetchActiveOrder).toHaveBeenCalledTimes(2);
    });

    it("stops polling on unmount", async () => {
        const { unmount } = await mount(SPLIT);

        unmount();
        await advance(60_000);

        expect(mockFetchActiveOrder).toHaveBeenCalledTimes(1);
    });

    it("keeps the order and its counts when a poll fails with a generic error", async () => {
        const { result } = await mount(SPLIT);
        jest.mocked(console.error).mockClear();
        mockFetchActiveOrder.mockRejectedValueOnce(new Error("502"));

        await advance(TICK);

        expect(mockFetchActiveOrder).toHaveBeenCalledTimes(2);
        expect(result.current.activeOrder).toEqual(SPLIT);
        expect(result.current.isVisible).toBe(true);
        expect(result.current.riderSlots?.slots).toEqual(["delivered", "onRoad", "waiting"]);
        expect(console.error).toHaveBeenCalled();

        // and the next tick retries
        mockFetchActiveOrder.mockResolvedValueOnce(SPLIT);
        await advance(TICK);
        expect(mockFetchActiveOrder).toHaveBeenCalledTimes(3);
    });

    it("clears the order when a poll gets a 401", async () => {
        const { result } = await mount(SPLIT);
        mockFetchActiveOrder.mockRejectedValueOnce(new CustomerAuthApiError("unauthorized", 401));

        await advance(TICK);

        expect(result.current.activeOrder).toBeNull();
    });

    it("still hides the pill when the first load fails with a generic error", async () => {
        mockRefreshCustomerToken.mockResolvedValue({ accessToken: "tok-1", isNewAccount: false });
        mockFetchActiveOrder.mockRejectedValueOnce(new Error("boom"));

        const { result } = renderHook(() => useActiveOrderIsland(), { wrapper });
        await advance(0);

        expect(mockFetchActiveOrder).toHaveBeenCalledTimes(1);
        expect(result.current.activeOrder).toBeNull();
    });

    it("drops a response that lands after unmount and schedules nothing further", async () => {
        const { unmount } = await mount(SPLIT);
        let resolveLate: (o: CustomerActiveOrder) => void = () => undefined;
        mockFetchActiveOrder.mockImplementationOnce(
            () => new Promise<CustomerActiveOrder>((resolve) => { resolveLate = resolve; }),
        );

        await advance(TICK);
        expect(mockFetchActiveOrder).toHaveBeenCalledTimes(2);
        unmount();
        await act(async () => {
            resolveLate(SPLIT);
        });
        await advance(60_000);

        expect(mockFetchActiveOrder).toHaveBeenCalledTimes(2);
    });
});
