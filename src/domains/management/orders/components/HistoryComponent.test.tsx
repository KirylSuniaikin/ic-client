import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import React, { useState } from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { HistoryDateRange, Order } from "../../../order/types";
import type { UseOrderHistoryResult } from "../hooks/useOrderHistory";
import type { IBranch } from "../../inventory/types";

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/public.ts
jest.mock("../../../../shared/api/public");
// The hook owns all fetch/pagination/search logic; the component test controls it directly.
jest.mock("../hooks/useOrderHistory");

import * as publicApi from "../../../../shared/api/public";
import { useOrderHistory } from "../hooks/useOrderHistory";
import HistoryComponent from "./HistoryComponent";
import { emotionRulesFor } from "../../couriers/components/emotionRules.testutil";

// __mocks__/public.ts (owned by Phase 2) only exports what useAdminOrders/useOrderHistory
// tests need, so it has no deleteOrder/updateOrderStatus — OrderCard/useDeleteOrder reach
// for those at call time (not at import time), so patching them onto the already-mocked
// module object here is sufficient without touching that shared mock file.
const mockDeleteOrder = jest.fn<Promise<void>, [string]>();
const mockUpdateOrderStatus = jest.fn<Promise<void>, [unknown]>();
(publicApi as unknown as { deleteOrder: unknown }).deleteOrder = mockDeleteOrder;
(publicApi as unknown as { updateOrderStatus: unknown }).updateOrderStatus = mockUpdateOrderStatus;

const mockUseOrderHistory = jest.mocked(useOrderHistory);
const mockGetHistory = jest.mocked(publicApi.getHistory);
// Cast: jest.requireActual returns unknown in this jest typing; the module shape is known.
const actualHistoryHook = jest.requireActual("../hooks/useOrderHistory") as typeof import("../hooks/useOrderHistory");

function makeOrder(id: string, orderNo: number): Order {
    return {
        id,
        order_no: orderNo,
        tel: "12345678",
        customer_name: "Test Customer",
        delivery_method: "Pick Up",
        payment_type: "Cash",
        address: "",
        notes: "",
        items: [],
        amount_paid: 10,
        order_type: "Pick Up",
        external_id: null,
        phone_number: "12345678",
        order_created: new Date().toISOString(),
        status: "Picked Up",
        isPaid: true,
        branch_id: "branch-1",
    };
}

// Stateful stand-in for the real hook: keeps `orders`/`searchInput`/`loading` in
// genuine React state so setOrders/setSearchInput calls made by the component are
// observable via re-render, exactly like the real hook would behave. Optionally
// exposes the `loading` setter through `loadingControl` so a test can flip it from
// true to false deterministically (reproducing the real hook's mount sequence)
// without relying on a real timer.
function makeMockHookImplementation(
    overrides: {
        initialOrders?: Order[];
        hasMore?: boolean;
        loading?: boolean;
        error?: string | null;
        loadMore?: () => void;
    } = {},
    loadingControl?: { current: ((loading: boolean) => void) | null }
): (branchId: string) => UseOrderHistoryResult {
    const loadMoreSpy = overrides.loadMore ?? jest.fn();

    return (): UseOrderHistoryResult => {
        const [orders, setOrders] = useState<Order[]>(overrides.initialOrders ?? []);
        const [searchInput, setSearchInput] = useState<string>("");
        const [dateRange, setDateRange] = useState<HistoryDateRange | null>(null);
        const [loading, setLoading] = useState<boolean>(overrides.loading ?? false);

        if (loadingControl) loadingControl.current = setLoading;

        return {
            orders,
            setOrders,
            loading,
            loadingMore: false,
            hasMore: overrides.hasMore ?? false,
            error: overrides.error ?? null,
            searchInput,
            setSearchInput,
            dateRange,
            setDateRange,
            loadMore: loadMoreSpy,
        };
    };
}

// Captures the callback passed to `new IntersectionObserver(cb)` so tests can fire
// it manually to simulate the sentinel scrolling into view.
let capturedObserverCallback: IntersectionObserverCallback | null = null;
let observeSpy: ReturnType<typeof jest.fn>;
let disconnectSpy: ReturnType<typeof jest.fn>;

class FakeIntersectionObserver implements IntersectionObserver {
    readonly root: Element | Document | null = null;
    readonly rootMargin: string = "";
    readonly thresholds: ReadonlyArray<number> = [];

    constructor(callback: IntersectionObserverCallback) {
        capturedObserverCallback = callback;
    }

    observe: (target: Element) => void = (...args) => observeSpy(...args);
    unobserve: (target: Element) => void = () => undefined;
    disconnect: () => void = (...args) => disconnectSpy(...args);
    takeRecords: () => IntersectionObserverEntry[] = () => [];
}

// No ManagementBranchScopeProvider is mounted here, so useBranchScope falls back to this
// prop unchanged (see MULTIBRANCH_SPEC.md Part 1) -- a full IBranch is needed since the
// component's prop type widened from a loose {id} shape to IBranch.
const testBranch: IBranch = {
    id: "branch-1",
    externalId: "ext-1",
    branchNo: 1,
    branchName: "Main",
    locale: "en",
    latitude: null,
    longitude: null,
};

// OrderCard calls useNavigate() unconditionally — wrap every render in a router.
function renderHistory(): ReturnType<typeof render> {
    return render(
        <MemoryRouter>
            <HistoryComponent onClose={onClose} selectedBranch={testBranch} />
        </MemoryRouter>
    );
}

const onClose = jest.fn<void, []>();

describe("HistoryComponent", () => {

    beforeEach(() => {
        jest.clearAllMocks();
        capturedObserverCallback = null;
        observeSpy = jest.fn();
        disconnectSpy = jest.fn();
        // IntersectionObserver is not implemented in jsdom — install the fake for every test.
        (global as unknown as { IntersectionObserver: typeof IntersectionObserver }).IntersectionObserver =
            FakeIntersectionObserver as unknown as typeof IntersectionObserver;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("search icon toggle", () => {
        it("does not render a search input before the icon is clicked", () => {
            mockUseOrderHistory.mockImplementation(makeMockHookImplementation());

            renderHistory();

            expect(screen.queryByPlaceholderText(/search by order id/i)).toBeNull();
        });

        it("reveals a search text input when the search icon button is clicked", () => {
            mockUseOrderHistory.mockImplementation(makeMockHookImplementation());

            renderHistory();

            fireEvent.click(screen.getByRole("button", { name: /search/i }));

            expect(screen.getByPlaceholderText(/search by order id/i)).toBeTruthy();
        });

        it("shows the search-format examples on hovering the info icon", async () => {
            mockUseOrderHistory.mockImplementation(makeMockHookImplementation());

            renderHistory();
            fireEvent.click(screen.getByRole("button", { name: /search/i }));
            fireEvent.mouseOver(screen.getByTestId("InfoOutlinedIcon"));

            const tooltip = await screen.findByRole("tooltip");

            expect(tooltip.textContent).toContain("97311111111");
            expect(tooltip.textContent).toContain("1234");
        });

        it("hides the search input again when the toggle is clicked a second time", () => {
            mockUseOrderHistory.mockImplementation(makeMockHookImplementation());

            renderHistory();

            const toggle = screen.getByRole("button", { name: /search/i });
            fireEvent.click(toggle);
            expect(screen.getByPlaceholderText(/search by order id/i)).toBeTruthy();

            fireEvent.click(toggle);
            expect(screen.queryByPlaceholderText(/search by order id/i)).toBeNull();
        });

        it("forwards typed input to the hook's setSearchInput", () => {
            mockUseOrderHistory.mockImplementation(makeMockHookImplementation());

            renderHistory();

            fireEvent.click(screen.getByRole("button", { name: /search/i }));
            const input = screen.getByPlaceholderText(/search by order id/i);
            fireEvent.change(input, { target: { value: "John" } });

            expect(screen.getByDisplayValue("John")).toBeTruthy();
        });
    });

    describe("date range calendar", () => {
        // 19 Oct 2026, so "Last 3 months" is 19 Jul -> 19 Oct.
        beforeEach(() => {
            jest.useFakeTimers();
            jest.setSystemTime(new Date(2026, 9, 19, 12, 0));
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        function openSearch(): void {
            fireEvent.click(screen.getByRole("button", { name: /search/i }));
        }

        function applyLastThreeMonths(): void {
            fireEvent.click(screen.getByRole("button", { name: /filter by date/i }));
            fireEvent.click(screen.getByRole("button", { name: "Last 3 months" }));
            fireEvent.click(screen.getByRole("button", { name: "Apply" }));
        }

        it("shows no calendar button while the search bar is closed", () => {
            mockUseOrderHistory.mockImplementation(makeMockHookImplementation());

            renderHistory();

            expect(screen.queryByRole("button", { name: /filter by date/i })).toBeNull();
        });

        it("shows the calendar button once the search bar is open", () => {
            mockUseOrderHistory.mockImplementation(makeMockHookImplementation());

            renderHistory();
            openSearch();

            expect(screen.getByRole("button", { name: /filter by date/i })).toBeTruthy();
        });

        it("opens the stats' range picker, fast picks included, from the calendar button", () => {
            mockUseOrderHistory.mockImplementation(makeMockHookImplementation());

            renderHistory();
            openSearch();
            fireEvent.click(screen.getByRole("button", { name: /filter by date/i }));

            expect(screen.getByRole("button", { name: "Last 6 months" })).toBeTruthy();
            expect(screen.getByRole("button", { name: "Apply" })).toBeTruthy();
        });

        it("shows the applied range as a chip beside the search box", () => {
            mockUseOrderHistory.mockImplementation(makeMockHookImplementation());

            renderHistory();
            openSearch();
            applyLastThreeMonths();

            expect(screen.getByTestId("history-date-range-chip").textContent).toBe("Jul 19, 2026 — Oct 19, 2026");
        });

        it("shows no range chip before a range is applied", () => {
            mockUseOrderHistory.mockImplementation(makeMockHookImplementation());

            renderHistory();
            openSearch();

            expect(screen.queryByTestId("history-date-range-chip")).toBeNull();
        });

        it("clears the range when the chip's close icon is pressed", () => {
            mockUseOrderHistory.mockImplementation(makeMockHookImplementation());

            renderHistory();
            openSearch();
            applyLastThreeMonths();
            fireEvent.click(screen.getByTestId("CloseRoundedIcon"));

            expect(screen.queryByTestId("history-date-range-chip")).toBeNull();
        });

        it("clears the range along with the search text when the search bar is closed", () => {
            mockUseOrderHistory.mockImplementation(makeMockHookImplementation());

            renderHistory();
            openSearch();
            applyLastThreeMonths();
            openSearch();
            openSearch();

            expect(screen.queryByTestId("history-date-range-chip")).toBeNull();
        });

        it("refetches page 0 for the applied range, keeping the typed search", async () => {
            mockUseOrderHistory.mockImplementation(actualHistoryHook.useOrderHistory);
            mockGetHistory.mockResolvedValue({ orders: [], hasMore: false });

            renderHistory();
            openSearch();
            fireEvent.change(screen.getByPlaceholderText(/search by order id/i), { target: { value: "Ahmed" } });
            applyLastThreeMonths();
            await act(async () => { jest.advanceTimersByTime(300); });

            expect(mockGetHistory).toHaveBeenLastCalledWith(expect.objectContaining({
                page: 0,
                filter: { type: "customerName", value: "Ahmed" },
                dateRange: { startDate: "2026-07-19", finishDate: "2026-10-19" },
            }));
        });

        it("drops the range from the next fetch once the search bar is closed", async () => {
            mockUseOrderHistory.mockImplementation(actualHistoryHook.useOrderHistory);
            mockGetHistory.mockResolvedValue({ orders: [], hasMore: false });

            renderHistory();
            openSearch();
            applyLastThreeMonths();
            await act(async () => { jest.advanceTimersByTime(300); });
            openSearch();
            await act(async () => { jest.advanceTimersByTime(300); });

            expect(mockGetHistory).toHaveBeenLastCalledWith(expect.objectContaining({
                page: 0,
                filter: { type: "none" },
                dateRange: null,
            }));
        });
    });

    describe("infinite scroll sentinel", () => {
        it("attaches the observer after the real loading=true -> false mount sequence", () => {
            const loadingControl: { current: ((loading: boolean) => void) | null } = { current: null };
            mockUseOrderHistory.mockImplementation(
                makeMockHookImplementation(
                    { initialOrders: [makeOrder("1", 11111111)], hasMore: true, loading: true },
                    loadingControl
                )
            );

            renderHistory();

            // On the first commit `loading` is true (as in the real hook). The sentinel is
            // mounted — only the list is swapped for the spinner — but the observer effect
            // early-returns while loading, so nothing is observed yet.
            expect(observeSpy).not.toHaveBeenCalled();

            // Simulate the initial page-0 fetch resolving: `loading` flips to false,
            // the sentinel mounts, and the observer must (re-)attach to it.
            act(() => { loadingControl.current?.(false); });

            expect(observeSpy).toHaveBeenCalledTimes(1);
        });

        it("observes the sentinel element via IntersectionObserver", () => {
            mockUseOrderHistory.mockImplementation(
                makeMockHookImplementation({ initialOrders: [makeOrder("1", 11111111)], hasMore: true })
            );

            renderHistory();

            expect(observeSpy).toHaveBeenCalledTimes(1);
        });

        it("calls loadMore when the sentinel becomes intersecting", () => {
            const loadMore = jest.fn<void, []>();
            mockUseOrderHistory.mockImplementation(
                makeMockHookImplementation({ initialOrders: [makeOrder("1", 11111111)], hasMore: true, loadMore })
            );

            renderHistory();

            expect(capturedObserverCallback).not.toBeNull();
            capturedObserverCallback!(
                [{ isIntersecting: true } as IntersectionObserverEntry],
                {} as IntersectionObserver
            );

            expect(loadMore).toHaveBeenCalledTimes(1);
        });

        // Owner, 19 Oct 2026: loading the next page threw the list back to its first orders. Masonry
        // shows the appended cards first in the flex order for a frame, and Chrome's scroll
        // anchoring follows the shuffle; with anchoring off the list stays where it was scrolled.
        it("keeps the list where it was scrolled when a page is appended", () => {
            mockUseOrderHistory.mockImplementation(
                makeMockHookImplementation({ initialOrders: [makeOrder("1", 11111111)], hasMore: true })
            );

            renderHistory();

            expect(emotionRulesFor(screen.getByTestId("history-scroll-list"))).toContain("overflow-anchor:none");
        });

        it("does not call loadMore when the sentinel is not intersecting", () => {
            const loadMore = jest.fn<void, []>();
            mockUseOrderHistory.mockImplementation(
                makeMockHookImplementation({ initialOrders: [makeOrder("1", 11111111)], hasMore: true, loadMore })
            );

            renderHistory();

            capturedObserverCallback!(
                [{ isIntersecting: false } as IntersectionObserverEntry],
                {} as IntersectionObserver
            );

            expect(loadMore).not.toHaveBeenCalled();
        });
    });

    describe("order creation date", () => {
        it("renders the server-formatted creation date verbatim", () => {
            mockUseOrderHistory.mockImplementation(
                makeMockHookImplementation({
                    initialOrders: [{ ...makeOrder("1", 11111111), order_created_formatted: "2026-10-08 01:30" }],
                })
            );

            renderHistory();

            expect(screen.getByText("Date:")).toBeTruthy();
            expect(screen.getByText(/2026-10-08 01:30/)).toBeTruthy();
        });

        it("renders no Date label when the field is absent", () => {
            mockUseOrderHistory.mockImplementation(
                makeMockHookImplementation({ initialOrders: [makeOrder("1", 11111111)] })
            );

            renderHistory();

            expect(screen.queryByText("Date:")).toBeNull();
        });
    });

    describe("delete order flow (regression — useDeleteOrder/OrderCard untouched)", () => {
        it("removes the order from the rendered list after confirming delete", async () => {
            mockUseOrderHistory.mockImplementation(
                makeMockHookImplementation({
                    initialOrders: [makeOrder("1", 11111111), makeOrder("2", 22222222)],
                })
            );
            mockDeleteOrder.mockResolvedValue(undefined);

            renderHistory();

            expect(screen.getByText(/11111111/)).toBeTruthy();
            expect(screen.getByText(/22222222/)).toBeTruthy();

            // Each OrderCard renders one DeleteIcon IconButton; the first one belongs
            // to order #11111111 (cards render in newest-first sorted order, and both
            // fixtures share the same order_created instant here so DOM order matches
            // insertion order).
            const deleteButtons = screen.getAllByRole("button").filter(btn =>
                btn.querySelector('[data-testid="DeleteIcon"]')
            );
            expect(deleteButtons.length).toBeGreaterThan(0);

            fireEvent.click(deleteButtons[0]);

            const confirmButton = await screen.findByRole("button", { name: /^delete$/i });
            fireEvent.click(confirmButton);

            await waitFor(() => expect(mockDeleteOrder).toHaveBeenCalledTimes(1));
            await waitFor(() => expect(screen.queryByText(/11111111/)).toBeNull());
            expect(screen.getByText(/22222222/)).toBeTruthy();
        });
    });
});
