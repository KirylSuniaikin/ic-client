import { jest, describe, it, expect, beforeAll, beforeEach, afterEach } from "@jest/globals";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
// i18n instance (side-effect import) so keys resolve to English under the default language.
import "../../../shared/i18n";

// lottie-web tries to obtain a real 2D canvas context at import time, which jsdom does not
// provide -- stub the package so the unconditional Lottie import does not crash the suite.
jest.mock("lottie-react", () => ({
    __esModule: true,
    default: (): null => null,
}));

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/customerAuth.ts. OrderStatusContent
// now transitively calls useCustomerAuth (via useCourierTracking), which throws outside a provider —
// hence every render below goes through the CustomerAuthProvider-wrapped `renderStatus` helper.
jest.mock("../../../shared/api/customerAuth");

// Same hoisted-mock shape as OrderRouteMap.test.tsx / CourierTrackingMap.test.tsx: the map only
// ever mounts for the "renders the map" / "GOOGLE_MAPS_API_KEY falsy" cases below, but every test
// imports this module transitively via CourierTrackingMap, so it must always be safe to load.
const mockLoaderState: { isLoaded: boolean } = { isLoaded: true };
type MockGoogleMapProps = { onLoad?: (map: unknown) => void };

jest.mock("@react-google-maps/api", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useEffect } = require("react") as typeof import("react");
    return {
        useJsApiLoader: () => mockLoaderState,
        GoogleMap: ({ onLoad }: MockGoogleMapProps) => {
            useEffect(() => {
                onLoad?.(mockMapInstance);
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, []);
            return <div data-testid="google-map" />;
        },
    };
});

const mockMapsKey: { value: string | undefined } = { value: "test-key" };
jest.mock("../../branch/utils/mapsConfig", () => ({
    get GOOGLE_MAPS_API_KEY(): string | undefined { return mockMapsKey.value; },
    GOOGLE_MAPS_MAP_ID: undefined,
    LIGHT_MAP_STYLES: [],
}));

import { fetchCourierLocation, refreshCustomerToken } from "../../../shared/api/customerAuth";
import { CustomerAuthProvider, __resetCustomerAuthStoreForTests } from "../../customer-auth/context/CustomerAuthProvider";
import { OrderStatusContent } from "./OrderStatusContent";
import type { OrderStatusData, OrderTrackingResponse } from "../types";

const mockFetchCourierLocation = jest.mocked(fetchCourierLocation);
const mockRefreshCustomerToken = jest.mocked(refreshCustomerToken);

class FakeMarker {
    map: unknown;

    constructor(public options: { map?: unknown }) {
        this.map = options.map;
    }

    setMap(map: unknown): void {
        this.map = map;
    }

    setPosition(): void {
        // Positioning isn't asserted from this file — CourierTrackingMap.test.tsx owns that.
    }
}

const mockMapInstance = {
    setCenter: (): void => undefined,
    setZoom: (): void => undefined,
};

function installGoogleStub(): void {
    (globalThis as unknown as { google: unknown }).google = { maps: { Marker: FakeMarker } };
}

beforeAll(installGoogleStub);

function order(overrides: Partial<OrderStatusData> = {}): OrderStatusData {
    return {
        id: 1,
        orderNumber: 42,
        orderStatus: "Kitchen Phase",
        orderCreated: "2026-07-01 12:00",
        estimationTime: 30,
        branchId: "branch-1",
        orderType: "Pick Up",
        ...overrides,
    };
}

function courierResponse(overrides: Partial<OrderTrackingResponse> = {}): OrderTrackingResponse {
    return { couriers: [], ...overrides };
}

function renderStatus(props: { order: OrderStatusData | null; remainingSeconds: number }): ReturnType<typeof render> {
    return render(
        <CustomerAuthProvider>
            <OrderStatusContent {...props} />
        </CustomerAuthProvider>
    );
}

function reachedStages(): number {
    return screen.getAllByTestId(/^order-stage-\d+$/)
        .filter((node) => node.getAttribute("data-reached") === "true").length;
}

// Every render mounts CustomerAuthProvider's own async silent-refresh effect (mirrors
// CustomerAuthModals.test.tsx's identical helper) — awaiting it after every render, even in
// tests that don't care about the token, keeps that state update inside `act()` instead of
// leaking a "not wrapped in act(...)" warning into whichever test runs next.
async function waitForAuthReady(): Promise<void> {
    await waitFor(() => expect(mockRefreshCustomerToken).toHaveBeenCalled());
}

beforeEach(() => {
    __resetCustomerAuthStoreForTests();
    mockLoaderState.isLoaded = true;
    mockMapsKey.value = "test-key";
    mockRefreshCustomerToken.mockReset();
    mockRefreshCustomerToken.mockRejectedValue(new Error("no session"));
    mockFetchCourierLocation.mockReset();
    mockFetchCourierLocation.mockResolvedValue(courierResponse());
    jest.spyOn(console, "debug").mockImplementation(() => undefined);
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe("OrderStatusContent", () => {
    it("keeps the pickup copy and the three-step ladder for a pickup order", async () => {
        renderStatus({ order: order({ orderStatus: "Ready" }), remainingSeconds: 0 });
        await waitForAuthReady();

        expect(screen.getByText(/Your order is ready for pickup!/)).toBeTruthy();
        expect(screen.getAllByTestId(/^order-stage-\d+$/)).toHaveLength(3);
        expect(reachedStages()).toBe(3);
    });

    it("gives a delivery order the five-step ladder", async () => {
        renderStatus({ order: order({ orderType: "Delivery", orderStatus: "Ready" }), remainingSeconds: 0 });
        await waitForAuthReady();

        expect(screen.getAllByTestId(/^order-stage-\d+$/)).toHaveLength(5);
        // Ready is a waypoint on a delivery, so two steps are still ahead.
        expect(reachedStages()).toBe(3);
    });

    it("tells a delivery customer the order is waiting for a courier, not to come and collect", async () => {
        renderStatus({ order: order({ orderType: "Delivery", orderStatus: "Ready" }), remainingSeconds: 0 });
        await waitForAuthReady();

        expect(screen.getByText("Your order is ready and waiting for a courier 🛵")).toBeTruthy();
        expect(screen.queryByText(/Come in and grab it/)).toBeNull();
    });

    describe("Out for delivery", () => {
        const riding = order({
            orderType: "Delivery",
            orderStatus: "Out for delivery",
            handoverAt: "2026-07-01T12:25:00",
            estimatedDeliveredAt: "2026-07-01T12:47:00",
        });

        it("gives the ride its own treatment instead of falling through every status", async () => {
            renderStatus({ order: riding, remainingSeconds: 0 });
            await waitForAuthReady();

            expect(screen.getByText("Your order is on the way 🛵")).toBeTruthy();
            expect(screen.getByTestId("delivery-ride-animation")).toBeTruthy();
            expect(reachedStages()).toBe(4);
        });

        it("shows the expected arrival as a Bahrain wall clock", async () => {
            renderStatus({ order: riding, remainingSeconds: 0 });
            await waitForAuthReady();

            expect(screen.getByTestId("ride-arrival-line").textContent).toBe("Arriving around 12:47");
        });

        it("says the arrival is not known yet rather than inventing one", async () => {
            renderStatus({
                order: order({ orderType: "Delivery", orderStatus: "Out for delivery" }),
                remainingSeconds: 0,
            });
            await waitForAuthReady();

            expect(screen.getByTestId("ride-arrival-line").textContent)
                .toBe("We'll have an arrival time as soon as a courier picks it up.");
        });

        // The countdown is to Ready. Past Ready it is stale, so it must not be on screen at all.
        it("drops the ready countdown once the ride has started", async () => {
            renderStatus({ order: riding, remainingSeconds: 600 });
            await waitForAuthReady();

            expect(screen.queryByText(/Will be ready in/)).toBeNull();
        });
    });

    it("closes the ladder on a delivered order", async () => {
        renderStatus({ order: order({ orderType: "Delivery", orderStatus: "Delivered" }), remainingSeconds: 0 });
        await waitForAuthReady();

        expect(screen.getByText("Delivered — enjoy! 🍕")).toBeTruthy();
        expect(reachedStages()).toBe(5);
    });

    it("still counts down to ready before the kitchen is done", async () => {
        renderStatus({ order: order({ orderType: "Delivery" }), remainingSeconds: 125 });
        await waitForAuthReady();

        expect(screen.getByText(/Will be ready in/)).toBeTruthy();
        expect(screen.getByText(/2:05/)).toBeTruthy();
    });

    // runs/1b/task-spec.md §9/§11 — the courier map only ever appears inside the existing
    // `riding` branch, gated by useCourierTracking's own token/delivery/status checks.
    describe("courier tracking map", () => {
        it("does not render a map for a pickup order, even while (hypothetically) out for delivery", async () => {
            renderStatus({
                order: order({ orderType: "Pick Up", orderStatus: "Out for delivery", id: 7 }),
                remainingSeconds: 0,
            });
            await waitForAuthReady();

            // isDelivery=false keeps useCourierTracking's `trackable` false regardless of token —
            // it never even reaches for the endpoint.
            expect(mockFetchCourierLocation).not.toHaveBeenCalled();
            expect(screen.queryByTestId("google-map")).toBeNull();
        });

        it("does not render a map before 'Out for delivery'", async () => {
            renderStatus({
                order: order({ orderType: "Delivery", orderStatus: "Ready", id: 7 }),
                remainingSeconds: 0,
            });
            await waitForAuthReady();

            // The `riding` block itself never mounts, so CourierTrackingMap isn't even rendered.
            expect(screen.queryByTestId("google-map")).toBeNull();
        });

        it("renders the map when out for delivery with a mocked non-empty fetchCourierLocation response", async () => {
            mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "tok-1", isNewAccount: false });
            mockFetchCourierLocation.mockResolvedValue(courierResponse({
                couriers: [{ name: "Ali", latitude: 26.2285, longitude: 50.586, positionAgeSeconds: 10, partIndex: 1 }],
            }));

            renderStatus({
                order: order({ orderType: "Delivery", orderStatus: "Out for delivery", id: 7 }),
                remainingSeconds: 0,
            });

            await waitFor(() => expect(mockFetchCourierLocation).toHaveBeenCalledWith("tok-1", 7));
            await waitFor(() => expect(screen.getByTestId("google-map")).toBeTruthy());
        });

        it("does not render a map (nor an error) when out for delivery but fetchCourierLocation resolves an empty couriers list", async () => {
            mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "tok-1", isNewAccount: false });
            mockFetchCourierLocation.mockResolvedValue(courierResponse());

            renderStatus({
                order: order({ orderType: "Delivery", orderStatus: "Out for delivery", id: 7 }),
                remainingSeconds: 0,
            });

            await waitFor(() => expect(mockFetchCourierLocation).toHaveBeenCalledWith("tok-1", 7));
            expect(screen.queryByTestId("google-map")).toBeNull();
            expect(screen.getByText("Your order is on the way 🛵")).toBeTruthy();
        });

        it("does not render a map when GOOGLE_MAPS_API_KEY is mocked falsy, even though the order is out for delivery", async () => {
            mockMapsKey.value = undefined;
            mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "tok-1", isNewAccount: false });
            mockFetchCourierLocation.mockResolvedValue(courierResponse({
                couriers: [{ name: "Ali", latitude: 26.2285, longitude: 50.586, positionAgeSeconds: 10, partIndex: 1 }],
            }));

            renderStatus({
                order: order({ orderType: "Delivery", orderStatus: "Out for delivery", id: 7 }),
                remainingSeconds: 0,
            });

            await waitFor(() => expect(mockFetchCourierLocation).toHaveBeenCalledWith("tok-1", 7));
            expect(screen.queryByTestId("google-map")).toBeNull();
        });
    });
});
