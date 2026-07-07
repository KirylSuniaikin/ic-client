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
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "tok-1" });
        mockFetchActiveOrder.mockResolvedValueOnce(null);

        const { result } = renderHook(() => useActiveOrderIsland(), { wrapper });
        await waitForAuthReady();

        await waitFor(() => expect(mockFetchActiveOrder).toHaveBeenCalledWith("tok-1"));
        expect(result.current.isVisible).toBe(false);
        expect(result.current.activeOrder).toBeNull();
    });

    it("is visible with correct timeLeft/totalSec derivation when an active order exists", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "tok-1" });
        mockFetchActiveOrder.mockResolvedValueOnce(ACTIVE_ORDER);

        const { result } = renderHook(() => useActiveOrderIsland(), { wrapper });
        await waitForAuthReady();

        await waitFor(() => expect(result.current.isVisible).toBe(true));
        expect(result.current.activeOrder).toEqual(ACTIVE_ORDER);
        expect(result.current.totalSec).toBe(15 * 60);
        expect(result.current.timeLeft).toBeGreaterThan(0);
    });

    it("falls back to a 15-minute totalSec when estimation is null", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "tok-1" });
        mockFetchActiveOrder.mockResolvedValueOnce({ ...ACTIVE_ORDER, estimation: null });

        const { result } = renderHook(() => useActiveOrderIsland(), { wrapper });
        await waitForAuthReady();

        await waitFor(() => expect(result.current.isVisible).toBe(true));
        expect(result.current.totalSec).toBe(15 * 60);
    });

    it("hides the pill once a live frame advances the tracked order to Picked Up", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "tok-1" });
        mockFetchActiveOrder.mockResolvedValueOnce(ACTIVE_ORDER);
        mockFetchActiveOrder.mockResolvedValueOnce(null);

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

    it("handleClick calls openOrderDetail with the active order's id", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "tok-1" });
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
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "tok-1" });
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
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "tok-1" });
        mockFetchActiveOrder.mockRejectedValueOnce(new Error("network down"));

        const { result } = renderHook(() => useActiveOrderIsland(), { wrapper });
        await waitForAuthReady();

        await waitFor(() => expect(mockFetchActiveOrder).toHaveBeenCalledWith("tok-1"));
        expect(result.current.activeOrder).toBeNull();
        expect(result.current.isVisible).toBe(false);
    });

    it("re-fetches the active order on a live status advance and hides the pill when the refetch reports none active", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "tok-1" });
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
