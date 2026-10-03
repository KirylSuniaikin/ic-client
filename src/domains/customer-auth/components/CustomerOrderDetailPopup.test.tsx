import { jest, describe, it, expect, beforeEach, beforeAll, afterEach } from "@jest/globals";
import React, { useState } from "react";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";

// CustomerOrderDetailPopup renders its copy via useTranslation — initialize the real
// i18n instance so keys resolve to English under the default language (also gives the
// Arabic-locale status-chip tests below a handle to drive i18n.changeLanguage).
import i18n, { DEFAULT_LANGUAGE } from "../../../shared/i18n";

jest.mock("../../../shared/api/customerAuth");
// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/socket.ts
jest.mock("../../../shared/api/socket");

// The courier map is the real CourierTrackingMap, so Google is mocked the way
// CourierTrackingMap.test.tsx / OrderStatusContent.test.tsx do it: one hoisted factory whose
// GoogleMap hands the fake map to onLoad and records the `options` it was given (the gesture
// mode is only observable there).
type MockMapOptions = { gestureHandling?: string };
type MockGoogleMapProps = { onLoad?: (map: unknown) => void; options?: MockMapOptions };
let mockRenderedMapOptions: Array<MockMapOptions | undefined> = [];

jest.mock("@react-google-maps/api", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useEffect } = require("react") as typeof import("react");
    return {
        useJsApiLoader: () => ({ isLoaded: true }),
        GoogleMap: ({ onLoad, options }: MockGoogleMapProps) => {
            mockRenderedMapOptions.push(options);
            useEffect(() => {
                onLoad?.(mockMapInstance);
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, []);
            return <div data-testid="google-map" />;
        },
    };
});

// The real key is read from process.env at import time and is absent under test, which would
// make the map render nothing and every "shows the map" assertion below vacuous.
jest.mock("../../branch/utils/mapsConfig", () => ({
    GOOGLE_MAPS_API_KEY: "test-key",
    GOOGLE_MAPS_MAP_ID: undefined,
    LIGHT_MAP_STYLES: [],
}));

import { refreshCustomerToken, logoutCustomer, fetchOrderDetail, fetchCourierLocation } from "../../../shared/api/customerAuth";
import { connectSocket, socket } from "../../../shared/api/socket";
import { CustomerAuthProvider, useCustomerAuth, __resetCustomerAuthStoreForTests } from "../context/CustomerAuthProvider";
import { CustomerAuthUiProvider, useCustomerAuthUi } from "../context/CustomerAuthUiProvider";
import * as courierTracking from "../../order-status/hooks/useCourierTracking";
import { CustomerOrderDetailPopup } from "./CustomerOrderDetailPopup";
import type { CustomerOrderDetail, MenuLocalizationCatalog } from "../types";
import type { OrderTrackingResponse } from "../../order-status/types";

const mockRefreshCustomerToken = jest.mocked(refreshCustomerToken);
const mockLogoutCustomer = jest.mocked(logoutCustomer);
const mockFetchOrderDetail = jest.mocked(fetchOrderDetail);
const mockFetchCourierLocation = jest.mocked(fetchCourierLocation);
const mockConnectSocket = jest.mocked(connectSocket);
const mockSubscribe = jest.mocked(socket.subscribe);
// Captured before any spy is installed: the popup keeps running the REAL hook (so polling and
// the map behave as in production) while the spy records the arguments it was given. CRA's
// `resetMocks: true` strips a spy's call-through before every test, hence re-installing it in
// beforeEach.
const realUseCourierTracking = courierTracking.useCourierTracking;

class FakeMarker {
    map: unknown;

    constructor(public options: { map?: unknown }) {
        this.map = options.map;
    }

    setMap(map: unknown): void {
        this.map = map;
    }

    setPosition(): void {
        // Positioning is CourierTrackingMap.test.tsx's concern, not this popup's.
    }
}

class FakeLatLngBounds {
    extend(): void {
        // Bounds contents are CourierTrackingMap.test.tsx's concern, not this popup's.
    }
}

const mockMapInstance = {
    setCenter: (): void => undefined,
    setZoom: (): void => undefined,
    fitBounds: (): void => undefined,
    getZoom: (): number | undefined => undefined,
};

// Captures the frame handler passed to socket.subscribe so a test can simulate a live frame.
function getFrameHandler(): (frame: { body: string }) => void {
    const call = mockSubscribe.mock.calls[mockSubscribe.mock.calls.length - 1] as
        [string, (frame: { body: string }) => void];
    return call[1];
}

function detail(overrides: Partial<CustomerOrderDetail> = {}): CustomerOrderDetail {
    return {
        id: 1234,
        orderNumber: 88,
        status: "Picked Up",
        orderType: "Pick Up",
        branchId: "branch-1",
        createdAt: "2026-06-20 18:42",
        paymentType: "Cash",
        notes: "Extra napkins please",
        amount: 15.0,
        discount: 1.5,
        amountPaid: 13.5,
        isPaid: true,
        items: [
            {
                name: "Pepperoni",
                quantity: 2,
                size: "M",
                unitAmount: 6.5,
                description: "",
                comboItems: [],
            },
        ],
        statusHistory: [
            { status: "Kitchen Phase", changedAt: "2026-06-20 18:10" },
            { status: "Oven", changedAt: "2026-06-20 18:20" },
            { status: "Ready", changedAt: "2026-06-20 18:35" },
            { status: "Picked Up", changedAt: "2026-06-20 18:42" },
        ],
        ...overrides,
    };
}

// Mirrors CustomerProfilePopup.test.tsx: the popup only ever flips to `open`
// once the provider's silent-refresh-on-mount has resolved, so tests never
// open it with a stale/null token like production never does.
function DetailPopupHarness({
    orderId,
    onClose,
    menuLocalizationData,
}: {
    orderId: number | null;
    onClose: () => void;
    menuLocalizationData?: MenuLocalizationCatalog;
}): React.JSX.Element {
    const { isAuthLoading } = useCustomerAuth();
    // Publishes the catalog CustomerOrderDetailPopup reads via useCustomerAuthUi() —
    // mirrors HomePage publishing its own useMenuData() result in production.
    const { setMenuLocalizationData } = useCustomerAuthUi();
    const [open, setOpen] = useState(false);
    return (
        <>
            {!isAuthLoading && (
                <button
                    onClick={() => {
                        if (menuLocalizationData) setMenuLocalizationData(menuLocalizationData);
                        setOpen(true);
                    }}
                >
                    open-detail
                </button>
            )}
            <CustomerOrderDetailPopup
                open={open}
                orderId={orderId}
                onClose={() => {
                    setOpen(false);
                    onClose();
                }}
            />
        </>
    );
}

async function renderPopup(
    orderId: number | null = 1234,
    menuLocalizationData?: MenuLocalizationCatalog,
): Promise<{ onClose: () => void }> {
    const onClose = jest.fn<void, []>();
    render(
        <CustomerAuthProvider>
            <CustomerAuthUiProvider>
                <DetailPopupHarness orderId={orderId} onClose={onClose} menuLocalizationData={menuLocalizationData} />
            </CustomerAuthUiProvider>
        </CustomerAuthProvider>
    );
    fireEvent.click(await screen.findByRole("button", { name: "open-detail" }));
    return { onClose };
}

beforeAll(() => {
    jest.spyOn(console, "debug").mockImplementation(() => undefined);
    (globalThis as unknown as { google: unknown }).google = {
        maps: { Marker: FakeMarker, LatLngBounds: FakeLatLngBounds },
    };
});

beforeEach(() => {
    mockRefreshCustomerToken.mockReset();
    mockLogoutCustomer.mockReset();
    mockFetchOrderDetail.mockReset();
    __resetCustomerAuthStoreForTests();

    // Simulate instant connection: invoke onConnect synchronously, return an unregister fn —
    // mirrors useOrderStatus.test.ts's harness style.
    mockConnectSocket.mockReset();
    mockConnectSocket.mockImplementation((onConnect: () => void) => {
        onConnect();
        return jest.fn<void, []>();
    });
    mockSubscribe.mockReset();
    mockSubscribe.mockReturnValue({ id: "detail-sub", unsubscribe: jest.fn() });

    jest.spyOn(courierTracking, "useCourierTracking").mockImplementation(realUseCourierTracking);
    mockFetchCourierLocation.mockReset();
    mockFetchCourierLocation.mockResolvedValue({ couriers: [] });
    mockRenderedMapOptions = [];
});

afterEach(async () => {
    // Reset the shared i18n singleton so a language change in one test doesn't leak into others.
    await act(async () => {
        await i18n.changeLanguage(DEFAULT_LANGUAGE);
    });
});

describe("CustomerOrderDetailPopup", () => {
    it("renders items, totals, notes, and the status timeline from a mocked fetchOrderDetail response", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });
        mockFetchOrderDetail.mockResolvedValueOnce(detail());

        await renderPopup();

        expect(await screen.findByText("Order ID #88")).toBeTruthy();
        expect(screen.getByText("Pepperoni")).toBeTruthy();
        expect(screen.getByText("6.50 BHD")).toBeTruthy();
        expect(screen.getByText("Qty : 2 Item")).toBeTruthy();
        expect(screen.getByText("15.00 BHD")).toBeTruthy();
        expect(screen.getByText("-1.50 BHD")).toBeTruthy();
        expect(screen.getByText("Payment Method: Cash")).toBeTruthy();
        expect(screen.getByText("Paid")).toBeTruthy();
        expect(screen.getByText("Extra napkins please")).toBeTruthy();

        // "Picked Up" appears twice: the status pill (detail.status) and the
        // timeline's friendly label for the last statusHistory entry.
        expect(screen.getAllByText("Picked Up").length).toBe(2);
        expect(screen.getByText("Order in Progress")).toBeTruthy();
        expect(screen.getByText("In the Oven")).toBeTruthy();
        expect(screen.getByText("Ready for Pickup")).toBeTruthy();
        expect(screen.getByText("6:42 PM")).toBeTruthy();

        expect(mockFetchOrderDetail).toHaveBeenCalledWith("detail-token", 1234);
    });

    it("hides the Notes card when notes is empty/null", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });
        mockFetchOrderDetail.mockResolvedValueOnce(detail({ notes: null }));

        await renderPopup();

        await screen.findByText("Order ID #88");
        expect(screen.queryByText("Notes")).toBeNull();
    });

    it("hides the Notes card when notes is blank after trim", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });
        mockFetchOrderDetail.mockResolvedValueOnce(detail({ notes: "   " }));

        await renderPopup();

        await screen.findByText("Order ID #88");
        expect(screen.queryByText("Notes")).toBeNull();
    });

    it("shows Unpaid (not Paid) when the order's isPaid flag is false", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });
        mockFetchOrderDetail.mockResolvedValueOnce(detail({ isPaid: false }));

        await renderPopup();

        await screen.findByText("Order ID #88");
        expect(screen.getByText("Unpaid")).toBeTruthy();
        expect(screen.queryByText("Paid")).toBeNull();
    });

    it("falls back to the raw status string for an unmapped status", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });
        mockFetchOrderDetail.mockResolvedValueOnce(
            detail({ statusHistory: [{ status: "Some Unknown Status", changedAt: "2026-06-20 18:10" }] })
        );

        await renderPopup();

        await screen.findByText("Order ID #88");
        expect(screen.getByText("Some Unknown Status")).toBeTruthy();
    });

    /**
     * manual §04 edge 9 — what the customer sees after a no-show. The live pill goes quiet (see
     * `useActiveOrderIsland`), but the order does NOT disappear: it stays in their history with
     * the status that explains what happened. An order that vanished from history after a
     * returned delivery would look like it was never placed, on the one occasion the customer is
     * most likely to want to look it up.
     *
     * This popup had no delivery coverage at all — no delivery order, no delivery status, and no
     * returned order appeared in any of its 27 tests.
     */
    it("keeps a returned order in the customer's history with the status that explains it", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });
        mockFetchOrderDetail.mockResolvedValueOnce(detail({
            orderType: "Delivery",
            status: "Returned Undelivered",
            statusHistory: [
                { status: "Kitchen Phase", changedAt: "2026-06-20 18:10" },
                { status: "Ready", changedAt: "2026-06-20 18:35" },
                { status: "Out for delivery", changedAt: "2026-06-20 18:42" },
                { status: "Returned Undelivered", changedAt: "2026-06-20 19:05" },
            ],
        }));

        await renderPopup();

        await screen.findByText("Order ID #88");
        // The explaining status, in words — not the raw backend string and not a blank chip.
        expect(screen.getAllByText("Returned Undelivered").length).toBeGreaterThan(0);
        // …and the ride that preceded it is still on the timeline, so the customer can see the
        // order did leave the kitchen.
        expect(screen.getByText("Out for Delivery")).toBeTruthy();
        // The items are still there: a returned order is a completed record, not a deleted one.
        expect(screen.getByText("Pepperoni")).toBeTruthy();
    });

    /** The delivery ladder's own statuses have to resolve to copy, not leak the raw string. */
    it("names the ride in words while a delivery order is on the road", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });
        mockFetchOrderDetail.mockResolvedValueOnce(detail({
            orderType: "Delivery",
            status: "Out for delivery",
            statusHistory: [
                { status: "Ready", changedAt: "2026-06-20 18:35" },
                { status: "Out for delivery", changedAt: "2026-06-20 18:42" },
            ],
        }));

        await renderPopup();

        await screen.findByText("Order ID #88");
        expect(screen.getAllByText("Out for Delivery").length).toBeGreaterThan(0);
        // The literal backend value, lower-case `d`, must not reach the screen.
        expect(screen.queryByText("Out for delivery")).toBeNull();
    });

    /**
     * The Arabic half of the same rule. `returnedUndelivered` is translated in `customerAuth.json`
     * on both platforms, so a customer reading the app in Arabic must not be handed the English
     * status on the one screen that explains why their food never arrived.
     */
    it("translates a returned delivery order's status when the locale is Arabic", async () => {
        await act(async () => {
            await i18n.changeLanguage("ar");
        });
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });
        mockFetchOrderDetail.mockResolvedValueOnce(detail({
            orderType: "Delivery",
            status: "Returned Undelivered",
            statusHistory: [{ status: "Returned Undelivered", changedAt: "2026-06-20 19:05" }],
        }));

        await renderPopup();

        await waitFor(() =>
            expect(screen.getAllByText("تم إرجاع الطلب دون تسليم").length).toBeGreaterThan(0));
        expect(screen.queryByText("Returned Undelivered")).toBeNull();
    });

    // Task T6 §6: the header status chip must show the TRANSLATED label in Arabic, not the raw
    // English status string leaking through untranslated.
    it("shows the translated Arabic status on the header chip and timeline when the locale is Arabic", async () => {
        await act(async () => {
            await i18n.changeLanguage("ar");
        });
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });
        mockFetchOrderDetail.mockResolvedValueOnce(detail());

        await renderPopup();

        await screen.findByText("رقم الطلب #88");
        // "تم الاستلام" (Picked Up) appears twice: the header status chip and the timeline's
        // label for the last statusHistory entry — same duplication the English test asserts.
        expect(screen.getAllByText("تم الاستلام").length).toBe(2);
        // Raw English must never leak through onto the chip/timeline in Arabic.
        expect(screen.queryByText("Picked Up")).toBeNull();
    });

    // task-spec.md §6: fetchOrderDetail routes through customerAuthFetch, which already
    // retried a silent refresh before this 401 ever reached the popup — so the handler
    // must not call the destructive context logout() (POST /auth/logout) on top of that;
    // only a failed refresh (handled internally by customerAuthFetch) ends the session.
    it("on a 401 from fetchOrderDetail, shows a session-expired message without calling logout()", async () => {
        const { CustomerAuthApiError } = await import("../types");
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });
        mockFetchOrderDetail.mockRejectedValueOnce(new CustomerAuthApiError("expired", 401));

        await renderPopup();

        expect(await screen.findByText("Your session has expired. Please log in again.")).toBeTruthy();
        expect(mockLogoutCustomer).not.toHaveBeenCalled();
    });

    it("shows an inline error message on a non-401 error and keeps the popup usable", async () => {
        const { CustomerAuthApiError } = await import("../types");
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });
        mockFetchOrderDetail.mockRejectedValueOnce(new CustomerAuthApiError("boom", 500));

        await renderPopup();

        expect(await screen.findByText("Could not load order details. Please try again.")).toBeTruthy();
        expect(mockLogoutCustomer).not.toHaveBeenCalled();
    });

    it("does not fetch when orderId is null", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });

        await renderPopup(null);

        await waitFor(() => expect(mockRefreshCustomerToken).toHaveBeenCalled());
        expect(mockFetchOrderDetail).not.toHaveBeenCalled();
    });

    it("shows a brand-red loading spinner while fetchOrderDetail is pending", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });
        // Never-resolving promise: only the pending/loading state is under test here.
        mockFetchOrderDetail.mockImplementationOnce(() => new Promise<CustomerOrderDetail>(() => undefined));

        await renderPopup();

        expect(await screen.findByRole("progressbar")).toBeTruthy();
    });

    it("calls onClose when the close icon is clicked", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });
        mockFetchOrderDetail.mockResolvedValueOnce(detail());

        await renderPopup();

        await screen.findByText("Order ID #88");
        fireEvent.click(screen.getByLabelText("Close"));

        await waitFor(() => expect(screen.queryByText("Order ID #88")).toBeNull());
    });

    it("shows the date parsed from createdAt alongside the time in the sub-row", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });
        mockFetchOrderDetail.mockResolvedValueOnce(detail());

        await renderPopup();

        expect(await screen.findByText("2026-06-20 - 6:42 PM")).toBeTruthy();
    });

    it("renders without crashing and shows zero totals when the order has no items and no status history", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });
        mockFetchOrderDetail.mockResolvedValueOnce(
            detail({ items: [], statusHistory: [], amount: 0, discount: 0 })
        );

        await renderPopup();

        expect(await screen.findByText("Order ID #88")).toBeTruthy();
        expect(screen.getByText("0.00 BHD")).toBeTruthy();
        expect(screen.getByText("-0.00 BHD")).toBeTruthy();
        expect(screen.getByText("Timeline Order")).toBeTruthy();
    });

    it("renders an item row without a literal 'null' size label when item.size is null", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });
        mockFetchOrderDetail.mockResolvedValueOnce(
            detail({
                items: [
                    {
                        name: "Margherita",
                        quantity: 1,
                        size: null,
                        unitAmount: 5,
                        description: "",
                        comboItems: [],
                    },
                ],
            })
        );

        await renderPopup();

        const itemImage = await screen.findByAltText("Margherita");
        expect(itemImage).toBeTruthy();
        expect(screen.queryByText("null", { exact: false })).toBeNull();
    });

    it("renders combo item name/size and description-derived extras when comboItems is non-empty", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });
        mockFetchOrderDetail.mockResolvedValueOnce(
            detail({
                items: [
                    {
                        name: "Family Combo",
                        quantity: 1,
                        size: "L",
                        unitAmount: 12,
                        description: "",
                        comboItems: [
                            {
                                name: "Pepperoni Pizza",
                                size: "M",
                                quantity: 1,
                                description: "Extra cheese + (No onions)",
                            },
                        ],
                    },
                ],
            })
        );

        await renderPopup();

        await screen.findByText("Family Combo");
        expect(screen.getByText("Pepperoni Pizza (M)")).toBeTruthy();
        expect(screen.getByText("+ Extra cheese", { exact: false })).toBeTruthy();
        expect(screen.getByText("+ No onions", { exact: false })).toBeTruthy();
    });

    it("renders no combo markup when comboItems is empty", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });
        mockFetchOrderDetail.mockResolvedValueOnce(detail());

        await renderPopup();

        await screen.findByText("Pepperoni");
        expect(screen.queryByText("+ Extra cheese", { exact: false })).toBeNull();
    });

    it("renders a combo item's name/size with no red extras block when its description is empty", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });
        mockFetchOrderDetail.mockResolvedValueOnce(
            detail({
                items: [
                    {
                        name: "Family Combo",
                        quantity: 1,
                        size: "L",
                        unitAmount: 12,
                        description: "",
                        comboItems: [
                            {
                                name: "Margherita Pizza",
                                size: "S",
                                quantity: 1,
                                description: "",
                            },
                        ],
                    },
                ],
            })
        );

        await renderPopup();

        await screen.findByText("Margherita Pizza (S)");
        expect(screen.queryByText("+", { exact: false })).toBeNull();
    });

    it("renders each combo item's name/size and extras when an item has multiple comboItems", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });
        mockFetchOrderDetail.mockResolvedValueOnce(
            detail({
                items: [
                    {
                        name: "Family Combo",
                        quantity: 1,
                        size: "L",
                        unitAmount: 12,
                        description: "",
                        comboItems: [
                            {
                                name: "Pepperoni Pizza",
                                size: "M",
                                quantity: 1,
                                description: "Extra cheese",
                            },
                            {
                                name: "Garlic Bread",
                                size: null,
                                quantity: 2,
                                description: "(No garlic)",
                            },
                        ],
                    },
                ],
            })
        );

        await renderPopup();

        await screen.findByText("Pepperoni Pizza (M)");
        expect(screen.getByText("Garlic Bread")).toBeTruthy();
        expect(screen.getByText("+ Extra cheese", { exact: false })).toBeTruthy();
        expect(screen.getByText("+ No garlic", { exact: false })).toBeTruthy();
    });

    it("does not render a combo sub-item's quantity anywhere in its row", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });
        mockFetchOrderDetail.mockResolvedValueOnce(
            detail({
                items: [
                    {
                        name: "Family Combo",
                        quantity: 1,
                        size: "L",
                        unitAmount: 12,
                        description: "",
                        comboItems: [
                            {
                                name: "Pepperoni Pizza",
                                size: "M",
                                quantity: 3,
                                description: "Extra cheese",
                            },
                        ],
                    },
                ],
            })
        );

        await renderPopup();

        await screen.findByText("Pepperoni Pizza (M)");
        // "Qty : 1 Item" is the parent Family Combo item's own quantity row —
        // the combo sub-item's quantity (3) must not surface as its own text node
        // (an exact match avoids false positives from unrelated substrings like "6:35 PM").
        expect(screen.getByText("Qty : 1 Item")).toBeTruthy();
        expect(screen.queryByText("3")).toBeNull();
    });

    it("subscribes to the order's branch topic and refetches detail on a forward-status live frame", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });
        mockFetchOrderDetail.mockResolvedValueOnce(detail({ status: "Kitchen Phase" }));
        mockFetchOrderDetail.mockResolvedValueOnce(detail({ status: "Oven" }));

        await renderPopup();
        await screen.findByText("Order ID #88");

        await waitFor(() => expect(mockSubscribe).toHaveBeenCalledTimes(1));
        const [topic] = mockSubscribe.mock.calls[0] as [string, ...unknown[]];
        expect(topic).toBe("/topic/branch-1/order-status-updated");

        const handler = getFrameHandler();
        act(() => {
            handler({ body: JSON.stringify({ id: 1234, status: "Oven" }) });
        });

        await waitFor(() => expect(mockFetchOrderDetail).toHaveBeenCalledTimes(2));
    });

    it("ignores a stale/lower-rank live frame — no second fetchOrderDetail call", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });
        mockFetchOrderDetail.mockResolvedValueOnce(detail({ status: "Ready" }));

        await renderPopup();
        await screen.findByText("Order ID #88");

        await waitFor(() => expect(mockSubscribe).toHaveBeenCalledTimes(1));
        const handler = getFrameHandler();

        // Advance to a higher rank first, then simulate a stale retry of a lower rank.
        act(() => {
            handler({ body: JSON.stringify({ id: 1234, status: "Ready" }) });
        });
        await waitFor(() => expect(mockFetchOrderDetail).toHaveBeenCalledTimes(2));

        act(() => {
            handler({ body: JSON.stringify({ id: 1234, status: "Kitchen Phase" }) });
        });

        // Give any (unwanted) async refetch a chance to happen, then assert it didn't.
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(mockFetchOrderDetail).toHaveBeenCalledTimes(2);
    });
});

// Task RW: the customer ingredient text is built from structured `customizations` (+ dough/crust
// flags), and the per-item `note` renders as its own separate line — never mixed into the
// (localized) ingredient text or shown from the raw stored `description`.
describe("CustomerOrderDetailPopup — structural display + note (task RW)", () => {
    it("builds the ingredient text from customizations and renders note as a separate line, not from the stored description", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });
        mockFetchOrderDetail.mockResolvedValueOnce(
            detail({
                items: [
                    {
                        name: "Margherita",
                        quantity: 1,
                        size: "M",
                        unitAmount: 5,
                        description: "STALE-DESCRIPTION-SHOULD-NOT-RENDER",
                        note: "cut in triangles please",
                        customizations: [{ action: "ADD", extraIngrId: 5, name: "Mushroom" }],
                        comboItems: [],
                    },
                ],
            })
        );

        await renderPopup(1234, { menuData: [], toppings: [], extraIngredients: [{ id: 5, name: "Mushroom", name_ar: "فطر" }] });

        await screen.findByText("Margherita");
        expect(screen.getByText("+ Mushroom", { exact: false })).toBeTruthy();
        expect(screen.getByText("cut in triangles please")).toBeTruthy();
        expect(screen.queryByText("STALE-DESCRIPTION-SHOULD-NOT-RENDER")).toBeNull();
    });

    it("resolves the addition name via name_ar by id when the locale is Arabic", async () => {
        await act(async () => {
            await i18n.changeLanguage("ar");
        });
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });
        mockFetchOrderDetail.mockResolvedValueOnce(
            detail({
                items: [
                    {
                        name: "Margherita",
                        quantity: 1,
                        size: "M",
                        unitAmount: 5,
                        description: "",
                        customizations: [{ action: "ADD", toppingId: 900, name: "Garlic" }],
                        comboItems: [],
                    },
                ],
            })
        );

        await renderPopup(1234, { menuData: [], toppings: [{ id: 900, name: "Garlic", name_ar: "ثوم" }], extraIngredients: [] });

        await screen.findByText("Margherita");
        expect(screen.getByText("ثوم Topping", { exact: false })).toBeTruthy();
    });

    it("shows the stored description as-is (legacy fallback) for a top-level item with no customizations and no dough/crust flags", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });
        mockFetchOrderDetail.mockResolvedValueOnce(
            detail({
                items: [
                    {
                        name: "Old Order Pizza",
                        quantity: 1,
                        size: "M",
                        unitAmount: 5,
                        description: "-(Onion) old-style legacy line",
                        comboItems: [],
                    },
                ],
            })
        );

        await renderPopup();

        await screen.findByText("Old Order Pizza");
        expect(screen.getByText("+ -Onion old-style legacy line", { exact: false })).toBeTruthy();
    });

    it("routes a dough-only item (isThinDough true, zero customizations) through the structural builder, not the legacy description fallback", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });
        mockFetchOrderDetail.mockResolvedValueOnce(
            detail({
                items: [
                    {
                        name: "Margherita",
                        quantity: 1,
                        size: "M",
                        unitAmount: 5,
                        description: "LEGACY-RAW-TEXT-SHOULD-NOT-RENDER",
                        customizations: [],
                        isThinDough: true,
                        comboItems: [],
                    },
                ],
            })
        );

        await renderPopup();

        await screen.findByText("Margherita");
        expect(screen.queryByText("LEGACY-RAW-TEXT-SHOULD-NOT-RENDER")).toBeNull();
        expect(screen.getByText("+ Thin Dough", { exact: false })).toBeTruthy();
    });
});

// The active-order pill on the home screen opens this popup, so it is where a customer looks for
// the courier during a ride. The map and the per-part rows must appear only for a delivery that
// is actually on the road.
describe("CustomerOrderDetailPopup — courier tracking", () => {
    const RIDING_HISTORY = [
        { status: "Ready", changedAt: "2026-06-20 18:35" },
        { status: "Out for delivery", changedAt: "2026-06-20 18:42" },
    ];

    function ridingDetail(overrides: Partial<CustomerOrderDetail> = {}): CustomerOrderDetail {
        return detail({ orderType: "Delivery", status: "Out for delivery", statusHistory: RIDING_HISTORY, ...overrides });
    }

    // A split order on the road: two riders, two parts — the shape the owner asked to see in full.
    function twoRiderResponse(): OrderTrackingResponse {
        return {
            couriers: [
                { name: "Ali", latitude: 26.2285, longitude: 50.586, positionAgeSeconds: 10, partIndex: 1 },
                { name: "Sara", latitude: 26.23, longitude: 50.59, positionAgeSeconds: 10, partIndex: 2 },
            ],
            parts: [
                { partIndex: 1, partsTotal: 2, delivered: false },
                { partIndex: 2, partsTotal: 2, delivered: false },
            ],
        };
    }

    function lastMapOptions(): MockMapOptions | undefined {
        return mockRenderedMapOptions[mockRenderedMapOptions.length - 1];
    }

    it("shows the courier map and the per-part progress for a delivery that is out for delivery", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });
        mockFetchOrderDetail.mockResolvedValueOnce(ridingDetail());
        mockFetchCourierLocation.mockResolvedValue(twoRiderResponse());

        await renderPopup();

        expect(await screen.findByTestId("google-map")).toBeTruthy();
        expect(mockFetchCourierLocation).toHaveBeenCalledWith("detail-token", 1234);
        expect(screen.getByTestId("courier-caption-1").textContent).toBe("Part 1 · Ali");
        expect(screen.getByTestId("courier-caption-2").textContent).toBe("Part 2 · Sara");
        expect(screen.getByTestId("delivery-part-progress-1")).toBeTruthy();
        expect(screen.getByTestId("delivery-part-progress-2")).toBeTruthy();
    });

    it("places the tracking block after the date line and before the items list", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });
        mockFetchOrderDetail.mockResolvedValueOnce(ridingDetail());
        mockFetchCourierLocation.mockResolvedValue(twoRiderResponse());

        await renderPopup();

        const tracking = await screen.findByTestId("order-detail-courier-tracking");
        await screen.findByTestId("google-map");
        const dateLine = screen.getByText("2026-06-20 - 6:42 PM");
        const firstItem = screen.getByText("Pepperoni");
        // DOCUMENT_POSITION_FOLLOWING: the argument comes after the node it is called on.
        expect(dateLine.compareDocumentPosition(tracking) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(tracking.compareDocumentPosition(firstItem) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    // Inside a scrolling sheet a one-finger drag has to scroll the sheet, not pan the map.
    it('asks the map for "cooperative" gesture handling', async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });
        mockFetchOrderDetail.mockResolvedValueOnce(ridingDetail());
        mockFetchCourierLocation.mockResolvedValue(twoRiderResponse());

        await renderPopup();

        await screen.findByTestId("google-map");
        expect(lastMapOptions()?.gestureHandling).toBe("cooperative");
    });

    // "Out for delivery" never happens to a pickup order; pairing them anyway is what isolates
    // the order-type gate from the status gate.
    it("shows neither the map nor the parts progress for a pickup order, and never asks for a location", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });
        mockFetchOrderDetail.mockResolvedValueOnce(ridingDetail({ orderType: "Pick Up" }));
        mockFetchCourierLocation.mockResolvedValue(twoRiderResponse());

        await renderPopup();

        await screen.findByText("Order ID #88");
        expect(screen.queryByTestId("order-detail-courier-tracking")).toBeNull();
        expect(screen.queryByTestId("google-map")).toBeNull();
        expect(screen.queryByTestId(/^delivery-part-progress-/)).toBeNull();
        expect(mockFetchCourierLocation).not.toHaveBeenCalled();
    });

    it.each(["Kitchen Phase", "Ready", "Picked Up", "Delivered", "Returned Undelivered"])(
        "shows neither the map nor the parts progress for a delivery whose status is %s",
        async (status) => {
            mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });
            mockFetchOrderDetail.mockResolvedValueOnce(ridingDetail({ status }));
            mockFetchCourierLocation.mockResolvedValue(twoRiderResponse());

            await renderPopup();

            await screen.findByText("Order ID #88");
            expect(screen.queryByTestId("order-detail-courier-tracking")).toBeNull();
            expect(screen.queryByTestId("google-map")).toBeNull();
            expect(screen.queryByTestId(/^delivery-part-progress-/)).toBeNull();
            expect(mockFetchCourierLocation).not.toHaveBeenCalled();
        }
    );

    it("shows neither while the detail is still loading", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });
        // Never-resolving promise: only the loading state is under test here.
        mockFetchOrderDetail.mockImplementationOnce(() => new Promise<CustomerOrderDetail>(() => undefined));
        mockFetchCourierLocation.mockResolvedValue(twoRiderResponse());

        await renderPopup();

        expect(await screen.findByRole("progressbar")).toBeTruthy();
        expect(screen.queryByTestId("order-detail-courier-tracking")).toBeNull();
        expect(screen.queryByTestId("google-map")).toBeNull();
        expect(mockFetchCourierLocation).not.toHaveBeenCalled();
    });

    // `detail` survives a close, so the id is the only thing standing between a closed sheet and
    // a poll that never stops.
    it("passes the hook a null order id while closed and the loaded order's id while open", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });
        mockFetchOrderDetail.mockResolvedValueOnce(ridingDetail());
        mockFetchCourierLocation.mockResolvedValue(twoRiderResponse());

        const tracking = jest.mocked(courierTracking.useCourierTracking);

        await renderPopup();

        expect(tracking.mock.calls[0]).toEqual([null, false, null]);

        await screen.findByTestId("google-map");
        expect(tracking).toHaveBeenLastCalledWith(1234, true, "Out for delivery");

        fireEvent.click(screen.getByLabelText("Close"));

        await waitFor(() => expect(screen.queryByTestId("google-map")).toBeNull());
        expect(tracking).toHaveBeenLastCalledWith(null, true, "Out for delivery");
    });

    it("shows the map once a live status frame flips the order to out for delivery", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });
        mockFetchOrderDetail.mockResolvedValueOnce(ridingDetail({ status: "Ready", statusHistory: RIDING_HISTORY.slice(0, 1) }));
        mockFetchOrderDetail.mockResolvedValueOnce(ridingDetail());
        mockFetchCourierLocation.mockResolvedValue(twoRiderResponse());

        await renderPopup();
        await screen.findByText("Order ID #88");
        expect(screen.queryByTestId("google-map")).toBeNull();
        expect(mockFetchCourierLocation).not.toHaveBeenCalled();

        await waitFor(() => expect(mockSubscribe).toHaveBeenCalledTimes(1));
        const handler = getFrameHandler();
        act(() => {
            handler({ body: JSON.stringify({ id: 1234, status: "Out for delivery" }) });
        });

        expect(await screen.findByTestId("google-map")).toBeTruthy();
        expect(mockFetchOrderDetail).toHaveBeenCalledTimes(2);
        expect(mockFetchCourierLocation).toHaveBeenCalledWith("detail-token", 1234);
        expect(screen.getByTestId("delivery-part-progress-1")).toBeTruthy();
    });

    describe("reopened on another order", () => {
        const ORDER_A = 1234;
        const ORDER_B = 5678;

        // Wired the way CustomerProfilePopup wires it: ONE selected id drives both `open` and
        // `orderId`, and closing clears it. The popup therefore stays mounted and its `detail`
        // carries over from one order to the next — the condition the stale-rider bug needs.
        function SelectedOrderHarness(): React.JSX.Element {
            const { isAuthLoading } = useCustomerAuth();
            const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
            return (
                <>
                    {!isAuthLoading && (
                        <>
                            <button onClick={() => setSelectedOrderId(ORDER_A)}>open-order-a</button>
                            <button onClick={() => setSelectedOrderId(ORDER_B)}>open-order-b</button>
                        </>
                    )}
                    <CustomerOrderDetailPopup
                        open={selectedOrderId !== null}
                        orderId={selectedOrderId}
                        onClose={() => setSelectedOrderId(null)}
                    />
                </>
            );
        }

        function riderResponse(name: string): OrderTrackingResponse {
            return { couriers: [{ name, latitude: 26.2285, longitude: 50.586, positionAgeSeconds: 10, partIndex: 1 }] };
        }

        async function openOrderA(): Promise<void> {
            render(
                <CustomerAuthProvider>
                    <CustomerAuthUiProvider>
                        <SelectedOrderHarness />
                    </CustomerAuthUiProvider>
                </CustomerAuthProvider>
            );
            fireEvent.click(await screen.findByRole("button", { name: "open-order-a" }));
            await screen.findByText("Order ID #88");
        }

        async function closeThenOpenOrderB(): Promise<void> {
            fireEvent.click(screen.getByLabelText("Close"));
            await waitFor(() => expect(screen.queryByText("Order ID #88")).toBeNull());
            // By text, not role: the closing Modal may still mark its siblings aria-hidden.
            fireEvent.click(screen.getByText("open-order-b"));
            await screen.findByText("Order ID #99");
        }

        beforeEach(() => {
            mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });
            mockFetchOrderDetail.mockImplementation((_token: string, id: number) =>
                Promise.resolve(ridingDetail({ id, orderNumber: id === ORDER_A ? 88 : 99 }))
            );
        });

        // On the first render of a reopen `detail` is still order A's; its id must not reach the
        // hook, or a poll goes out for an order nobody is looking at.
        it("never polls the previous order once the sheet is reopened on another one", async () => {
            mockFetchCourierLocation.mockImplementation((_token: string, id: number) =>
                Promise.resolve(riderResponse(id === ORDER_A ? "Ali" : "Sara"))
            );

            await openOrderA();
            expect(await screen.findByText("Ali")).toBeTruthy();
            const callsBeforeReopen = mockFetchCourierLocation.mock.calls.length;

            await closeThenOpenOrderB();

            expect(await screen.findByText("Sara")).toBeTruthy();
            expect(mockFetchCourierLocation.mock.calls.slice(callsBeforeReopen)).toEqual([["detail-token", ORDER_B]]);
            expect(screen.queryByText("Ali")).toBeNull();
        });

        // A's request is still in flight when the sheet closes and only answers once B's rider is
        // on the map. Applying it would put A's rider under B's header until B's next poll.
        it("keeps a late answer for the previous order off the next order's map", async () => {
            let answerOrderA: (response: OrderTrackingResponse) => void = () => undefined;
            mockFetchCourierLocation.mockImplementation((_token: string, id: number) =>
                id === ORDER_A
                    ? new Promise<OrderTrackingResponse>((resolve) => {
                          answerOrderA = resolve;
                      })
                    : Promise.resolve(riderResponse("Sara"))
            );

            await openOrderA();
            await waitFor(() => expect(mockFetchCourierLocation).toHaveBeenCalledWith("detail-token", ORDER_A));

            await closeThenOpenOrderB();
            expect(await screen.findByText("Sara")).toBeTruthy();

            await act(async () => {
                answerOrderA(riderResponse("Ali"));
            });

            expect(screen.queryByText("Ali")).toBeNull();
            expect(screen.getByText("Sara")).toBeTruthy();
        });
    });
});
