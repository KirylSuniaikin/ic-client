import { jest, describe, it, expect, beforeAll, beforeEach, afterEach } from "@jest/globals";
import React from "react";
import { renderHook, act } from "@testing-library/react";
import type { RenderHookResult } from "@testing-library/react";

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/customerAuth.ts
jest.mock("../../../shared/api/customerAuth");

import { fetchCourierLocation, refreshCustomerToken } from "../../../shared/api/customerAuth";
import { CustomerAuthProvider, __resetCustomerAuthStoreForTests } from "../../customer-auth/context/CustomerAuthProvider";
import { CustomerAuthApiError } from "../../customer-auth/types";
import { POLL_INTERVAL_MS, useCourierTracking } from "./useCourierTracking";
import type { UseCourierTrackingResult } from "./useCourierTracking";
import type { OrderTrackingResponse } from "../types";
import type { TrackedCourier, TrackedPart } from "../types";

const mockFetchCourierLocation = jest.mocked(fetchCourierLocation);
const mockRefreshCustomerToken = jest.mocked(refreshCustomerToken);

const COURIER: TrackedCourier = {
    name: "Ali",
    latitude: 26.2285,
    longitude: 50.586,
    positionAgeSeconds: 10,
    partIndex: 1,
    bearingDegrees: 90,
    etaSeconds: 300,
};

const COURIER_2: TrackedCourier = {
    name: "Sara",
    latitude: 26.23,
    longitude: 50.59,
    positionAgeSeconds: 12,
    partIndex: 2,
    bearingDegrees: null,
    etaSeconds: null,
};

const PARTS_2: TrackedPart[] = [
    { partIndex: 1, partsTotal: 2, delivered: true },
    { partIndex: 2, partsTotal: 2, delivered: false },
];

// useCourierTracking calls useCustomerAuth() internally, so every renderHook needs this
// ancestor — mirrors app/providers.tsx wiring (same shape as useActiveOrderIsland.test.ts).
function wrapper({ children }: { children: React.ReactNode }): React.JSX.Element {
    return React.createElement(CustomerAuthProvider, null, children);
}

function courierResponse(overrides: Partial<OrderTrackingResponse> = {}): OrderTrackingResponse {
    return { couriers: [], destination: null, ...overrides };
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
        expect(result.current.couriers).toEqual([]);
        expect(result.current.parts).toEqual([]);
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

    it("polls every 15 s, the courier app's reporting cadence while it carries an order", () => {
        expect(POLL_INTERVAL_MS).toBe(15_000);
    });

    it("fetches immediately on entering the trackable state, then again after POLL_INTERVAL_MS, and exactly once per tick thereafter", async () => {
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
        expect(result.current.couriers).toEqual([COURIER]);

        rerender({ status: "Delivered" });
        await flush();

        expect(result.current.couriers).toEqual([]);
        expect(result.current.parts).toEqual([]);
    });

    it("on a rejected fetch (CustomerAuthApiError), sets courier to null, logs via logger.debug, does not throw, and still fetches on the next tick", async () => {
        loginWithToken();
        mockFetchCourierLocation.mockResolvedValueOnce(courierResponse({ couriers: [COURIER] }));
        mockFetchCourierLocation.mockRejectedValueOnce(new CustomerAuthApiError("not found", 404));
        mockFetchCourierLocation.mockResolvedValueOnce(courierResponse({ couriers: [COURIER] }));

        const { result } = renderHook(() => useCourierTracking(1, true, "Out for delivery"), { wrapper });
        await flush();
        expect(result.current.couriers).toEqual([COURIER]);

        act(() => {
            jest.advanceTimersByTime(POLL_INTERVAL_MS);
        });
        await flush();

        expect(result.current.couriers).toEqual([]);
        expect(result.current.parts).toEqual([]);
        expect(console.debug).toHaveBeenCalledWith(
            "useCourierTracking: fetchCourierLocation failed",
            expect.any(CustomerAuthApiError)
        );

        act(() => {
            jest.advanceTimersByTime(POLL_INTERVAL_MS);
        });
        await flush();
        expect(result.current.couriers).toEqual([COURIER]);
        expect(mockFetchCourierLocation).toHaveBeenCalledTimes(3);
    });

    it("on a rejected fetch (plain Error), sets courier to null, logs via logger.debug, and does not throw", async () => {
        loginWithToken();
        mockFetchCourierLocation.mockRejectedValueOnce(new Error("network down"));

        const { result } = renderHook(() => useCourierTracking(1, true, "Out for delivery"), { wrapper });
        await flush();

        expect(result.current.couriers).toEqual([]);
        expect(result.current.parts).toEqual([]);
        expect(console.debug).toHaveBeenCalledWith(
            "useCourierTracking: fetchCourierLocation failed",
            expect.any(Error)
        );
    });

    // runs/6b/task-spec.md §11 — a rejected fetch clears BOTH fields to [], extending the
    // existing plain-Error case above to also pin `parts`.
    it("on a rejected fetch, clears both couriers and parts to []", async () => {
        loginWithToken();
        mockFetchCourierLocation.mockResolvedValueOnce(courierResponse({ couriers: [COURIER_2], parts: PARTS_2 }));
        mockFetchCourierLocation.mockRejectedValueOnce(new Error("network down"));

        const { result } = renderHook(() => useCourierTracking(1, true, "Out for delivery"), { wrapper });
        await flush();
        expect(result.current.couriers).toEqual([COURIER_2]);
        expect(result.current.parts).toEqual(PARTS_2);

        act(() => {
            jest.advanceTimersByTime(POLL_INTERVAL_MS);
        });
        await flush();

        expect(result.current.couriers).toEqual([]);
        expect(result.current.parts).toEqual([]);
    });

    // The order-detail sheet hands the hook another order id when it is reopened on another order,
    // and null when it closes. A request still in flight at that moment answers for an order the
    // hook no longer tracks; applying it would paint (or blank) the wrong riders until the next poll.
    describe("a late answer for an order it no longer tracks", () => {
        type Deferred = { resolve: (response: OrderTrackingResponse) => void; reject: (error: Error) => void };

        function deferNextFetch(): Deferred {
            const deferred: Deferred = { resolve: () => undefined, reject: () => undefined };
            mockFetchCourierLocation.mockImplementationOnce(
                () =>
                    new Promise<OrderTrackingResponse>((resolve, reject) => {
                        deferred.resolve = resolve;
                        deferred.reject = reject;
                    })
            );
            return deferred;
        }

        function renderForOrder(
            orderId: number | null,
        ): RenderHookResult<UseCourierTrackingResult, { id: number | null }> {
            return renderHook(
                ({ id }: { id: number | null }) => useCourierTracking(id, true, "Out for delivery"),
                { wrapper, initialProps: { id: orderId } }
            );
        }

        it("does not replace the new order's riders when the old order's answer lands after them", async () => {
            loginWithToken();
            const orderOne = deferNextFetch();
            mockFetchCourierLocation.mockResolvedValueOnce(courierResponse({ couriers: [COURIER_2], parts: PARTS_2 }));

            const { result, rerender } = renderForOrder(1);
            await flush();
            expect(mockFetchCourierLocation).toHaveBeenLastCalledWith("tok-1", 1);

            rerender({ id: 2 });
            await flush();
            expect(mockFetchCourierLocation).toHaveBeenLastCalledWith("tok-1", 2);
            expect(result.current.couriers).toEqual([COURIER_2]);

            await act(async () => {
                orderOne.resolve(courierResponse({ couriers: [COURIER] }));
            });
            await flush();

            expect(result.current.couriers).toEqual([COURIER_2]);
            expect(result.current.parts).toEqual(PARTS_2);
        });

        it("does not blank the new order's riders when the old order's request fails late", async () => {
            loginWithToken();
            const orderOne = deferNextFetch();
            mockFetchCourierLocation.mockResolvedValueOnce(courierResponse({ couriers: [COURIER_2], parts: PARTS_2 }));

            const { result, rerender } = renderForOrder(1);
            await flush();

            rerender({ id: 2 });
            await flush();
            expect(result.current.couriers).toEqual([COURIER_2]);

            await act(async () => {
                orderOne.reject(new Error("network down"));
            });
            await flush();

            expect(result.current.couriers).toEqual([COURIER_2]);
            expect(result.current.parts).toEqual(PARTS_2);
        });

        it("stays empty when an answer lands after the order id was withdrawn", async () => {
            loginWithToken();
            const orderOne = deferNextFetch();

            const { result, rerender } = renderForOrder(1);
            await flush();
            expect(mockFetchCourierLocation).toHaveBeenCalledTimes(1);

            rerender({ id: null });
            await flush();

            await act(async () => {
                orderOne.resolve(courierResponse({ couriers: [COURIER], parts: PARTS_2 }));
            });
            await flush();

            expect(result.current.couriers).toEqual([]);
            expect(result.current.parts).toEqual([]);
        });
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
        expect(result.current.couriers).toEqual([]);
        expect(result.current.parts).toEqual([]);
        expect(console.debug).not.toHaveBeenCalled();
    });

    // runs/6b/task-spec.md §11 — a two-courier response with no `parts` key sets couriers to
    // both entries and normalizes parts to [].
    it("sets couriers to both entries and parts to [] for a resolved {couriers: [c1, c2]} response with no parts key", async () => {
        loginWithToken();
        mockFetchCourierLocation.mockResolvedValue(courierResponse({ couriers: [COURIER, COURIER_2] }));

        const { result } = renderHook(() => useCourierTracking(1, true, "Out for delivery"), { wrapper });
        await flush();

        expect(result.current.couriers).toEqual([COURIER, COURIER_2]);
        expect(result.current.parts).toEqual([]);
    });

    // runs/6b/task-spec.md §11 — both fields are set from the same response in one state update:
    // a single waitFor checking both at once, rather than two sequential waits, proves there is no
    // render in between where one field is fresh and the other stale.
    it("sets couriers and parts together from a single split-order response, in one state update", async () => {
        loginWithToken();
        mockFetchCourierLocation.mockResolvedValue(courierResponse({ couriers: [COURIER_2], parts: PARTS_2 }));

        const { result } = renderHook(() => useCourierTracking(1, true, "Out for delivery"), { wrapper });
        await flush();

        expect({ couriers: result.current.couriers, parts: result.current.parts }).toEqual({
            couriers: [COURIER_2],
            parts: PARTS_2,
        });
    });

    describe("the customer's drop-off pin", () => {
        const HOME = { latitude: 26.24, longitude: 50.6 };

        it("hands over the destination with the couriers and parts of the same response", async () => {
            loginWithToken();
            mockFetchCourierLocation.mockResolvedValue(courierResponse({ couriers: [COURIER], destination: HOME }));

            const { result } = renderHook(() => useCourierTracking(1, true, "Out for delivery"), { wrapper });
            await flush();

            expect(result.current.couriers).toEqual([COURIER]);
            expect(result.current.destination).toEqual(HOME);
        });

        it("reads a response from a backend that predates the pin (no destination key) as no pin", async () => {
            loginWithToken();
            // The old wire shape, deliberately not an OrderTrackingResponse.
            const legacy = { couriers: [COURIER] } as unknown as OrderTrackingResponse;
            mockFetchCourierLocation.mockResolvedValue(legacy);

            const { result } = renderHook(() => useCourierTracking(1, true, "Out for delivery"), { wrapper });
            await flush();

            expect(result.current.couriers).toEqual([COURIER]);
            expect(result.current.destination).toBeNull();
        });

        it("clears the destination with the couriers when the order leaves 'Out for delivery'", async () => {
            loginWithToken();
            mockFetchCourierLocation.mockResolvedValue(courierResponse({ couriers: [COURIER], destination: HOME }));

            const { result, rerender } = renderHook(
                ({ status }: { status: string }) => useCourierTracking(1, true, status),
                { wrapper, initialProps: { status: "Out for delivery" } }
            );
            await flush();
            expect(result.current.destination).toEqual(HOME);

            rerender({ status: "Delivered" });
            await flush();

            expect(result.current.destination).toBeNull();
        });

        it("clears the destination on a failed poll, with the couriers", async () => {
            loginWithToken();
            mockFetchCourierLocation.mockResolvedValueOnce(courierResponse({ couriers: [COURIER], destination: HOME }));
            mockFetchCourierLocation.mockRejectedValueOnce(new Error("network down"));

            const { result } = renderHook(() => useCourierTracking(1, true, "Out for delivery"), { wrapper });
            await flush();
            expect(result.current.destination).toEqual(HOME);

            act(() => {
                jest.advanceTimersByTime(POLL_INTERVAL_MS);
            });
            await flush();

            expect(result.current.couriers).toEqual([]);
            expect(result.current.destination).toBeNull();
        });
    });
});
