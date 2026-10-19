import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { Order, GetHistoryResponse, HistoryDateRange } from "../../../order/types";

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/public.ts
jest.mock("../../../../shared/api/public");

import { getHistory } from "../../../../shared/api/public";
import { useOrderHistory } from "./useOrderHistory";

const mockGetHistory = jest.mocked(getHistory);

function makeOrder(id: string): Order {
    return {
        id,
        order_no: Number(id),
        tel: "12345678",
        customer_name: "Test",
        delivery_method: "Pick Up",
        payment_type: "Cash",
        address: "",
        notes: "",
        items: [],
        amount_paid: 0,
        order_type: "Pick Up",
        external_id: null,
        phone_number: "12345678",
        order_created: new Date().toISOString(),
        status: "Picked Up",
        isPaid: true,
        branch_id: "branch-1",
    };
}

function response(orders: Order[], hasMore: boolean): GetHistoryResponse {
    return { orders, hasMore };
}

const MID_OCTOBER: HistoryDateRange = { startDate: "2026-10-15", finishDate: "2026-10-19" };

describe("useOrderHistory", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe("initial page-0 load", () => {
        it("fetches page 0 with a 'none' filter on mount", async () => {
            mockGetHistory.mockResolvedValue(response([makeOrder("1")], false));

            const { result } = renderHook(() => useOrderHistory("branch-1"));

            await waitFor(() => expect(result.current.loading).toBe(false));

            expect(mockGetHistory).toHaveBeenCalledWith(
                expect.objectContaining({ branchId: "branch-1", page: 0, filter: { type: "none" } })
            );
            expect(result.current.orders).toHaveLength(1);
        });

        it("sets loading=true synchronously before the fetch resolves", () => {
            mockGetHistory.mockReturnValue(new Promise<GetHistoryResponse>(() => {}));

            const { result } = renderHook(() => useOrderHistory("branch-1"));

            expect(result.current.loading).toBe(true);
        });

        it("re-fetches page 0 when branchId changes", async () => {
            mockGetHistory.mockResolvedValue(response([], false));

            const { result, rerender } = renderHook(
                ({ branchId }: { branchId: string }) => useOrderHistory(branchId),
                { initialProps: { branchId: "branch-1" } }
            );

            await waitFor(() => expect(result.current.loading).toBe(false));
            mockGetHistory.mockClear();

            rerender({ branchId: "branch-2" });

            await waitFor(() =>
                expect(mockGetHistory).toHaveBeenCalledWith(
                    expect.objectContaining({ branchId: "branch-2", page: 0 })
                )
            );
        });
    });

    describe("loadMore pagination", () => {
        it("appends page 1 results to the existing orders", async () => {
            mockGetHistory.mockResolvedValueOnce(response([makeOrder("1")], true));

            const { result } = renderHook(() => useOrderHistory("branch-1"));
            await waitFor(() => expect(result.current.loading).toBe(false));

            mockGetHistory.mockResolvedValueOnce(response([makeOrder("2")], false));

            await act(async () => {
                result.current.loadMore();
                await Promise.resolve();
            });

            await waitFor(() => expect(result.current.orders).toHaveLength(2));
            expect(result.current.orders.map(o => o.id)).toEqual(["1", "2"]);
        });

        it("requests page+1 with the currently active filter", async () => {
            mockGetHistory.mockResolvedValueOnce(response([makeOrder("1")], true));
            const { result } = renderHook(() => useOrderHistory("branch-1"));
            await waitFor(() => expect(result.current.loading).toBe(false));

            mockGetHistory.mockResolvedValueOnce(response([], false));
            mockGetHistory.mockClear();

            await act(async () => {
                result.current.loadMore();
                await Promise.resolve();
            });

            expect(mockGetHistory).toHaveBeenCalledWith(
                expect.objectContaining({ page: 1, filter: { type: "none" } })
            );
        });

        it("does nothing when hasMore is false", async () => {
            mockGetHistory.mockResolvedValueOnce(response([makeOrder("1")], false));
            const { result } = renderHook(() => useOrderHistory("branch-1"));
            await waitFor(() => expect(result.current.loading).toBe(false));

            mockGetHistory.mockClear();

            await act(async () => {
                result.current.loadMore();
                await Promise.resolve();
            });

            expect(mockGetHistory).not.toHaveBeenCalled();
        });
    });

    describe("search input classification", () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        it("classifies an 8-digit input as an orderId filter", async () => {
            mockGetHistory.mockResolvedValue(response([], false));
            const { result } = renderHook(() => useOrderHistory("branch-1"));
            await act(async () => { await Promise.resolve(); });

            act(() => result.current.setSearchInput("12345678"));
            act(() => { jest.advanceTimersByTime(300); });
            await act(async () => { await Promise.resolve(); });

            expect(mockGetHistory).toHaveBeenLastCalledWith(
                expect.objectContaining({ filter: { type: "orderId", value: 12345678 } })
            );
        });

        it("classifies a 16-digit input as an externalId filter", async () => {
            mockGetHistory.mockResolvedValue(response([], false));
            const { result } = renderHook(() => useOrderHistory("branch-1"));
            await act(async () => { await Promise.resolve(); });

            act(() => result.current.setSearchInput("1234567890123456"));
            act(() => { jest.advanceTimersByTime(300); });
            await act(async () => { await Promise.resolve(); });

            expect(mockGetHistory).toHaveBeenLastCalledWith(
                expect.objectContaining({ filter: { type: "externalId", value: 1234567890123456 } })
            );
        });

        it("classifies free-text input as a customerName filter", async () => {
            mockGetHistory.mockResolvedValue(response([], false));
            const { result } = renderHook(() => useOrderHistory("branch-1"));
            await act(async () => { await Promise.resolve(); });

            act(() => result.current.setSearchInput("John Doe"));
            act(() => { jest.advanceTimersByTime(300); });
            await act(async () => { await Promise.resolve(); });

            expect(mockGetHistory).toHaveBeenLastCalledWith(
                expect.objectContaining({ filter: { type: "customerName", value: "John Doe" } })
            );
        });

        it("classifies numeric input that isn't 8 or 16 digits as customerName", async () => {
            mockGetHistory.mockResolvedValue(response([], false));
            const { result } = renderHook(() => useOrderHistory("branch-1"));
            await act(async () => { await Promise.resolve(); });

            act(() => result.current.setSearchInput("12345"));
            act(() => { jest.advanceTimersByTime(300); });
            await act(async () => { await Promise.resolve(); });

            expect(mockGetHistory).toHaveBeenLastCalledWith(
                expect.objectContaining({ filter: { type: "customerName", value: "12345" } })
            );
        });

        it("classifies an 11-digit input as a phone filter", async () => {
            mockGetHistory.mockResolvedValue(response([], false));
            const { result } = renderHook(() => useOrderHistory("branch-1"));
            await act(async () => { await Promise.resolve(); });

            act(() => result.current.setSearchInput("97333607710"));
            act(() => { jest.advanceTimersByTime(300); });
            await act(async () => { await Promise.resolve(); });

            expect(mockGetHistory).toHaveBeenLastCalledWith(
                expect.objectContaining({ filter: { type: "phone", value: "97333607710" } })
            );
        });

        it("classifies a 15-digit input as a phone filter (upper bound)", async () => {
            mockGetHistory.mockResolvedValue(response([], false));
            const { result } = renderHook(() => useOrderHistory("branch-1"));
            await act(async () => { await Promise.resolve(); });

            act(() => result.current.setSearchInput("123456789012345"));
            act(() => { jest.advanceTimersByTime(300); });
            await act(async () => { await Promise.resolve(); });

            expect(mockGetHistory).toHaveBeenLastCalledWith(
                expect.objectContaining({ filter: { type: "phone", value: "123456789012345" } })
            );
        });

        it("classifies a +-prefixed 12-character input as a phone filter with the + stripped", async () => {
            mockGetHistory.mockResolvedValue(response([], false));
            const { result } = renderHook(() => useOrderHistory("branch-1"));
            await act(async () => { await Promise.resolve(); });

            act(() => result.current.setSearchInput("+97333607710"));
            act(() => { jest.advanceTimersByTime(300); });
            await act(async () => { await Promise.resolve(); });

            expect(mockGetHistory).toHaveBeenLastCalledWith(
                expect.objectContaining({ filter: { type: "phone", value: "97333607710" } })
            );
        });

        it('classifies a 4-digit input with a leading zero as an orderNo filter, preserving the string', async () => {
            mockGetHistory.mockResolvedValue(response([], false));
            const { result } = renderHook(() => useOrderHistory("branch-1"));
            await act(async () => { await Promise.resolve(); });

            act(() => result.current.setSearchInput("0042"));
            act(() => { jest.advanceTimersByTime(300); });
            await act(async () => { await Promise.resolve(); });

            expect(mockGetHistory).toHaveBeenLastCalledWith(
                expect.objectContaining({ filter: { type: "orderNo", value: "0042" } })
            );
        });

        it("classifies a 10-digit numeric-only input as customerName", async () => {
            mockGetHistory.mockResolvedValue(response([], false));
            const { result } = renderHook(() => useOrderHistory("branch-1"));
            await act(async () => { await Promise.resolve(); });

            act(() => result.current.setSearchInput("1234567890"));
            act(() => { jest.advanceTimersByTime(300); });
            await act(async () => { await Promise.resolve(); });

            expect(mockGetHistory).toHaveBeenLastCalledWith(
                expect.objectContaining({ filter: { type: "customerName", value: "1234567890" } })
            );
        });

        it("classifies a 17-digit numeric-only input as customerName", async () => {
            mockGetHistory.mockResolvedValue(response([], false));
            const { result } = renderHook(() => useOrderHistory("branch-1"));
            await act(async () => { await Promise.resolve(); });

            act(() => result.current.setSearchInput("12345678901234567"));
            act(() => { jest.advanceTimersByTime(300); });
            await act(async () => { await Promise.resolve(); });

            expect(mockGetHistory).toHaveBeenLastCalledWith(
                expect.objectContaining({ filter: { type: "customerName", value: "12345678901234567" } })
            );
        });

        it("classifies empty/whitespace input as no filter", async () => {
            mockGetHistory.mockResolvedValue(response([], false));
            const { result } = renderHook(() => useOrderHistory("branch-1"));
            await act(async () => { await Promise.resolve(); });

            act(() => result.current.setSearchInput("   "));
            act(() => { jest.advanceTimersByTime(300); });
            await act(async () => { await Promise.resolve(); });

            expect(mockGetHistory).toHaveBeenLastCalledWith(
                expect.objectContaining({ filter: { type: "none" } })
            );
        });

        it("debounces rapid keystrokes into a single request", async () => {
            mockGetHistory.mockResolvedValue(response([], false));
            const { result } = renderHook(() => useOrderHistory("branch-1"));
            await act(async () => { await Promise.resolve(); });

            mockGetHistory.mockClear();

            act(() => result.current.setSearchInput("J"));
            act(() => { jest.advanceTimersByTime(100); });
            act(() => result.current.setSearchInput("Jo"));
            act(() => { jest.advanceTimersByTime(100); });
            act(() => result.current.setSearchInput("Joh"));
            act(() => { jest.advanceTimersByTime(300); });
            await act(async () => { await Promise.resolve(); });

            expect(mockGetHistory).toHaveBeenCalledTimes(1);
            expect(mockGetHistory).toHaveBeenCalledWith(
                expect.objectContaining({ filter: { type: "customerName", value: "Joh" } })
            );
        });
    });

    describe("date range", () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        it("sends no range on mount", async () => {
            mockGetHistory.mockResolvedValue(response([], false));

            renderHook(() => useOrderHistory("branch-1"));
            await act(async () => { await Promise.resolve(); });

            expect(mockGetHistory).toHaveBeenCalledWith(
                expect.objectContaining({ page: 0, filter: { type: "none" }, dateRange: null })
            );
        });

        it("refetches page 0 for the range once it is set", async () => {
            mockGetHistory.mockResolvedValue(response([], false));
            const { result } = renderHook(() => useOrderHistory("branch-1"));
            await act(async () => { await Promise.resolve(); });

            act(() => result.current.setDateRange(MID_OCTOBER));
            act(() => { jest.advanceTimersByTime(300); });
            await act(async () => { await Promise.resolve(); });

            expect(mockGetHistory).toHaveBeenLastCalledWith(
                expect.objectContaining({ page: 0, filter: { type: "none" }, dateRange: MID_OCTOBER })
            );
        });

        it("combines the range with the typed search", async () => {
            mockGetHistory.mockResolvedValue(response([], false));
            const { result } = renderHook(() => useOrderHistory("branch-1"));
            await act(async () => { await Promise.resolve(); });

            act(() => result.current.setSearchInput("Ahmed"));
            act(() => result.current.setDateRange(MID_OCTOBER));
            act(() => { jest.advanceTimersByTime(300); });
            await act(async () => { await Promise.resolve(); });

            expect(mockGetHistory).toHaveBeenLastCalledWith(
                expect.objectContaining({ page: 0, filter: { type: "customerName", value: "Ahmed" }, dateRange: MID_OCTOBER })
            );
        });

        it("resets paging and the loaded orders when the range changes", async () => {
            mockGetHistory.mockResolvedValueOnce(response([makeOrder("1")], true));
            const { result } = renderHook(() => useOrderHistory("branch-1"));
            await act(async () => { await Promise.resolve(); });
            mockGetHistory.mockResolvedValueOnce(response([makeOrder("2")], true));
            await act(async () => {
                result.current.loadMore();
                await Promise.resolve();
            });

            mockGetHistory.mockResolvedValueOnce(response([makeOrder("15")], true));
            act(() => result.current.setDateRange(MID_OCTOBER));
            act(() => { jest.advanceTimersByTime(300); });
            await act(async () => { await Promise.resolve(); });
            const ordersAfterRange = result.current.orders.map(o => o.id);
            mockGetHistory.mockResolvedValueOnce(response([], false));
            await act(async () => {
                result.current.loadMore();
                await Promise.resolve();
            });

            expect(ordersAfterRange).toEqual(["15"]);
            expect(mockGetHistory.mock.calls.map(([params]) => params.page)).toEqual([0, 1, 0, 1]);
            expect(mockGetHistory).toHaveBeenLastCalledWith(
                expect.objectContaining({ page: 1, dateRange: MID_OCTOBER })
            );
        });

        it("keeps paging within the range", async () => {
            mockGetHistory.mockResolvedValue(response([makeOrder("1")], true));
            const { result } = renderHook(() => useOrderHistory("branch-1"));
            await act(async () => { await Promise.resolve(); });
            act(() => result.current.setDateRange(MID_OCTOBER));
            act(() => { jest.advanceTimersByTime(300); });
            await act(async () => { await Promise.resolve(); });

            await act(async () => {
                result.current.loadMore();
                await Promise.resolve();
            });

            expect(mockGetHistory).toHaveBeenLastCalledWith(
                expect.objectContaining({ page: 1, dateRange: MID_OCTOBER })
            );
        });

        it("refetches without a range once it is cleared", async () => {
            mockGetHistory.mockResolvedValue(response([], false));
            const { result } = renderHook(() => useOrderHistory("branch-1"));
            await act(async () => { await Promise.resolve(); });
            act(() => result.current.setDateRange(MID_OCTOBER));
            act(() => { jest.advanceTimersByTime(300); });
            await act(async () => { await Promise.resolve(); });

            act(() => result.current.setDateRange(null));
            act(() => { jest.advanceTimersByTime(300); });
            await act(async () => { await Promise.resolve(); });

            expect(mockGetHistory).toHaveBeenLastCalledWith(
                expect.objectContaining({ page: 0, dateRange: null })
            );
        });

        it("ignores a slow response from before the range was applied", async () => {
            let resolveFirst!: (value: GetHistoryResponse) => void;
            mockGetHistory.mockReturnValueOnce(new Promise<GetHistoryResponse>((resolve) => { resolveFirst = resolve; }));
            const { result } = renderHook(() => useOrderHistory("branch-1"));

            mockGetHistory.mockResolvedValueOnce(response([makeOrder("in-range")], false));
            act(() => result.current.setDateRange(MID_OCTOBER));
            act(() => { jest.advanceTimersByTime(300); });
            await act(async () => { await Promise.resolve(); });
            await act(async () => {
                resolveFirst(response([makeOrder("stale")], false));
                await Promise.resolve();
            });

            expect(result.current.orders.map(o => o.id)).toEqual(["in-range"]);
        });

        it("keeps the range when the branch changes", async () => {
            mockGetHistory.mockResolvedValue(response([], false));
            const { result, rerender } = renderHook(
                ({ branchId }: { branchId: string }) => useOrderHistory(branchId),
                { initialProps: { branchId: "branch-1" } }
            );
            await act(async () => { await Promise.resolve(); });
            act(() => result.current.setDateRange(MID_OCTOBER));
            act(() => { jest.advanceTimersByTime(300); });
            await act(async () => { await Promise.resolve(); });
            mockGetHistory.mockClear();

            rerender({ branchId: "branch-2" });
            await act(async () => { await Promise.resolve(); });

            expect(mockGetHistory).toHaveBeenCalledWith(
                expect.objectContaining({ branchId: "branch-2", page: 0, dateRange: MID_OCTOBER })
            );
        });
    });

    describe("stale-response discarding", () => {
        it("ignores a slow page-0 response once a newer search has started", async () => {
            jest.useFakeTimers();

            let resolveFirst!: (value: GetHistoryResponse) => void;
            const firstCall = new Promise<GetHistoryResponse>((resolve) => { resolveFirst = resolve; });

            mockGetHistory.mockReturnValueOnce(firstCall);

            const { result } = renderHook(() => useOrderHistory("branch-1"));

            // Trigger a new search before the initial fetch resolves.
            mockGetHistory.mockResolvedValueOnce(response([makeOrder("new")], false));
            act(() => result.current.setSearchInput("customer"));
            act(() => { jest.advanceTimersByTime(300); });
            await act(async () => { await Promise.resolve(); });

            await waitFor(() => expect(result.current.orders.map(o => o.id)).toEqual(["new"]));

            // Stale response for the original ("none" filter) fetch resolves late.
            await act(async () => {
                resolveFirst(response([makeOrder("stale")], false));
                await Promise.resolve();
            });

            expect(result.current.orders.map(o => o.id)).toEqual(["new"]);
        });
    });

    describe("loadingMore lock release after a search supersedes an in-flight loadMore", () => {
        it("releases the loadingMore lock so a subsequent loadMore still fetches", async () => {
            jest.useFakeTimers();

            // Initial page-0 load.
            mockGetHistory.mockResolvedValueOnce(response([makeOrder("1")], true));
            const { result } = renderHook(() => useOrderHistory("branch-1"));
            await act(async () => { await Promise.resolve(); });

            // Start a loadMore fetch and leave it pending (in flight).
            let resolveLoadMore!: (value: GetHistoryResponse) => void;
            const loadMorePromise = new Promise<GetHistoryResponse>((resolve) => { resolveLoadMore = resolve; });
            mockGetHistory.mockReturnValueOnce(loadMorePromise);

            act(() => { result.current.loadMore(); });
            expect(result.current.loadingMore).toBe(true);

            // A new search supersedes the in-flight loadMore before it resolves.
            mockGetHistory.mockResolvedValueOnce(response([], true));
            act(() => result.current.setSearchInput("customer"));
            act(() => { jest.advanceTimersByTime(300); });
            await act(async () => { await Promise.resolve(); });

            // The stale loadMore response resolves late; its data must be discarded,
            // but the loadingMore lock must still be released.
            await act(async () => {
                resolveLoadMore(response([makeOrder("stale")], true));
                await Promise.resolve();
            });

            expect(result.current.loadingMore).toBe(false);
            expect(result.current.orders.map(o => o.id)).not.toContain("stale");

            // A subsequent loadMore call must actually fetch, not no-op.
            mockGetHistory.mockClear();
            mockGetHistory.mockResolvedValueOnce(response([makeOrder("2")], false));

            await act(async () => {
                result.current.loadMore();
                await Promise.resolve();
            });

            expect(mockGetHistory).toHaveBeenCalledWith(
                expect.objectContaining({ page: 1, filter: { type: "customerName", value: "customer" } })
            );
        });
    });
});
