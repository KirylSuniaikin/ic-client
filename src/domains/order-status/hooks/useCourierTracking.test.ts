import { jest, describe, it, expect, beforeAll, beforeEach, afterEach } from "@jest/globals";
import React from "react";
import { renderHook, act } from "@testing-library/react";

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/customerAuth.ts
jest.mock("../../../shared/api/customerAuth");

import { fetchCourierLocation, refreshCustomerToken } from "../../../shared/api/customerAuth";
import { CustomerAuthProvider, __resetCustomerAuthStoreForTests } from "../../customer-auth/context/CustomerAuthProvider";
import { CustomerAuthApiError } from "../../customer-auth/types";
import { POLL_INTERVAL_MS, useCourierTracking } from "./useCourierTracking";
import type { OrderTrackingResponse } from "../types";
import type { TrackedCourier } from "../types";

const mockFetchCourierLocation = jest.mocked(fetchCourierLocation);
const mockRefreshCustomerToken = jest.mocked(refreshCustomerToken);

const COURIER: TrackedCourier = {
    name: "Ali",
    latitude: 26.2285,
    longitude: 50.586,
    positionAgeSeconds: 10,
    partIndex: 1,
};

// useCourierTracking calls useCustomerAuth() internally, so every renderHook needs this
// ancestor — mirrors app/providers.tsx wiring (same shape as useActiveOrderIsland.test.ts).
function wrapper({ children }: { children: React.ReactNode }): React.JSX.Element {
    return React.createElement(CustomerAuthProvider, null, children);
}

function courierResponse(overrides: Partial<OrderTrackingResponse> = {}): OrderTrackingResponse {
    return { couriers: [], ...overrides };
}

function loginWithToken(): void {
    mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "tok-1", isNewAccount: false });
}

function setVisibility(state: "visible" | "hidden"): void {
    Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
}

// Fake timers pause @testing-library's `waitFor` (it polls with real setTimeout), so this suite
// flushes the microtask queue directly instead — the same pattern useOrderHistory.test.ts uses
// once its "search input classification" describe block switches to fake timers. Several rounds
// are cheap and cover deeper promise chains (silent-refresh -> setAccessToken -> effect -> fetch).
async function flush(times = 6): Promise<void> {
    for (let i = 0; i < times; i++) {
        // eslint-disable-next-line no-await-in-loop
        await act(async () => {
            await Promise.resolve();
        });
    }
}

beforeAll(() => {
    jest.spyOn(console, "debug").mockImplementation(() => undefined);
});

beforeEach(() => {
    jest.useFakeTimers();
    __resetCustomerAuthStoreForTests();
    mockRefreshCustomerToken.mockReset();
    mockRefreshCustomerToken.mockRejectedValue(new Error("no session"));
    mockFetchCourierLocation.mockReset();
    mockFetchCourierLocation.mockResolvedValue(courierResponse());
    setVisibility("visible");
});

afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
});

describe("useCourierTracking", () => {
    it("does not fetch when there is no token", async () => {
        const { result } = renderHook(() => useCourierTracking(1, true, "Out for delivery"), { wrapper });
        await flush();

        expect(mockFetchCourierLocation).not.toHaveBeenCalled();
        expect(result.current.courier).toBeNull();
    });

    it("does not fetch for a pickup order", async () => {
        loginWithToken();
        renderHook(() => useCourierTracking(1, false, "Out for delivery"), { wrapper });
        await flush();

        expect(mockFetchCourierLocation).not.toHaveBeenCalled();
    });

    it("does not fetch before 'Out for delivery'", async () => {
        loginWithToken();
        renderHook(() => useCourierTracking(1, true, "Ready"), { wrapper });
        await flush();

        expect(mockFetchCourierLocation).not.toHaveBeenCalled();
    });

    it("fetches immediately on entering the trackable state, then again after 20000ms, and exactly once per tick thereafter", async () => {
        loginWithToken();
        renderHook(() => useCourierTracking(1, true, "Out for delivery"), { wrapper });
        await flush();

        expect(mockFetchCourierLocation).toHaveBeenCalledTimes(1);
        expect(mockFetchCourierLocation).toHaveBeenCalledWith("tok-1", 1);

        act(() => {
            jest.advanceTimersByTime(POLL_INTERVAL_MS);
        });
        await flush();
        expect(mockFetchCourierLocation).toHaveBeenCalledTimes(2);

        act(() => {
            jest.advanceTimersByTime(POLL_INTERVAL_MS);
        });
        await flush();
        expect(mockFetchCourierLocation).toHaveBeenCalledTimes(3);
    });

    it("stops fetching after the tab is mocked hidden, and fetches immediately again once mocked visible", async () => {
        loginWithToken();
        renderHook(() => useCourierTracking(1, true, "Out for delivery"), { wrapper });
        await flush();
        expect(mockFetchCourierLocation).toHaveBeenCalledTimes(1);

        act(() => {
            setVisibility("hidden");
        });
        await flush();
        mockFetchCourierLocation.mockClear();

        act(() => {
            jest.advanceTimersByTime(POLL_INTERVAL_MS * 3);
        });
        await flush();
        expect(mockFetchCourierLocation).not.toHaveBeenCalled();

        act(() => {
            setVisibility("visible");
        });
        await flush();
        expect(mockFetchCourierLocation).toHaveBeenCalledTimes(1);
    });

    it("clears courier to null the instant the status prop changes away from 'Out for delivery'", async () => {
        loginWithToken();
        mockFetchCourierLocation.mockResolvedValue(courierResponse({ couriers: [COURIER] }));

        const { result, rerender } = renderHook(
            ({ status }: { status: string }) => useCourierTracking(1, true, status),
            { wrapper, initialProps: { status: "Out for delivery" } }
        );
        await flush();
        expect(result.current.courier).toEqual(COURIER);

        rerender({ status: "Delivered" });
        await flush();

        expect(result.current.courier).toBeNull();
    });

    it("on a rejected fetch (CustomerAuthApiError), sets courier to null, logs via logger.debug, does not throw, and still fetches on the next tick", async () => {
        loginWithToken();
        mockFetchCourierLocation.mockResolvedValueOnce(courierResponse({ couriers: [COURIER] }));
        mockFetchCourierLocation.mockRejectedValueOnce(new CustomerAuthApiError("not found", 404));
        mockFetchCourierLocation.mockResolvedValueOnce(courierResponse({ couriers: [COURIER] }));

        const { result } = renderHook(() => useCourierTracking(1, true, "Out for delivery"), { wrapper });
        await flush();
        expect(result.current.courier).toEqual(COURIER);

        act(() => {
            jest.advanceTimersByTime(POLL_INTERVAL_MS);
        });
        await flush();

        expect(result.current.courier).toBeNull();
        expect(console.debug).toHaveBeenCalledWith(
            "useCourierTracking: fetchCourierLocation failed",
            expect.any(CustomerAuthApiError)
        );

        act(() => {
            jest.advanceTimersByTime(POLL_INTERVAL_MS);
        });
        await flush();
        expect(result.current.courier).toEqual(COURIER);
        expect(mockFetchCourierLocation).toHaveBeenCalledTimes(3);
    });

    it("on a rejected fetch (plain Error), sets courier to null, logs via logger.debug, and does not throw", async () => {
        loginWithToken();
        mockFetchCourierLocation.mockRejectedValueOnce(new Error("network down"));

        const { result } = renderHook(() => useCourierTracking(1, true, "Out for delivery"), { wrapper });
        await flush();

        expect(result.current.courier).toBeNull();
        expect(console.debug).toHaveBeenCalledWith(
            "useCourierTracking: fetchCourierLocation failed",
            expect.any(Error)
        );
    });

    it("clears the interval and the visibility listener on unmount — no further calls after unmount + timer advance", async () => {
        loginWithToken();
        const { unmount } = renderHook(() => useCourierTracking(1, true, "Out for delivery"), { wrapper });
        await flush();
        expect(mockFetchCourierLocation).toHaveBeenCalledTimes(1);

        unmount();
        mockFetchCourierLocation.mockClear();

        act(() => {
            jest.advanceTimersByTime(POLL_INTERVAL_MS * 3);
        });
        await flush();

        expect(mockFetchCourierLocation).not.toHaveBeenCalled();
    });

    // §9 acceptance: "the visibilitychange listener [is] removed on unmount." Distinct from the
    // interval-clearing test above — this proves `useVisibility`'s own effect cleanup runs, not
    // just the polling effect's. If the listener leaked, dispatching the event post-unmount would
    // still be observable (either as an extra fetch on the next visible->hidden->visible cycle, or
    // as a React "state update on unmounted component" warning) — neither happens once removed.
    it("does not react to a visibilitychange event dispatched after unmount", async () => {
        loginWithToken();
        const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
        const { unmount } = renderHook(() => useCourierTracking(1, true, "Out for delivery"), { wrapper });
        await flush();
        mockFetchCourierLocation.mockClear();

        unmount();
        act(() => {
            setVisibility("hidden");
        });
        act(() => {
            setVisibility("visible");
        });
        await flush();

        expect(mockFetchCourierLocation).not.toHaveBeenCalled();
        expect(errorSpy).not.toHaveBeenCalled();
        errorSpy.mockRestore();
    });

    // Functional requirement 5 (task-spec.md §4): the "no courier yet" response is the default,
    // frequent, non-error state — the hook must not confuse it with a failure.
    it("keeps courier null on a resolved {couriers: []} response while trackable (feature flag off / no courier yet)", async () => {
        loginWithToken();
        mockFetchCourierLocation.mockResolvedValue(courierResponse());

        const { result } = renderHook(() => useCourierTracking(1, true, "Out for delivery"), { wrapper });
        await flush();

        expect(mockFetchCourierLocation).toHaveBeenCalledTimes(1);
        expect(result.current.courier).toBeNull();
        expect(console.debug).not.toHaveBeenCalled();
    });
});
