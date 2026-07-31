import { jest, describe, it, expect, beforeEach, beforeAll } from "@jest/globals";
import { renderHook, act, waitFor } from "@testing-library/react";
import { CashUpdateType } from "../types";
import type { CashRegisterEventTO, GetBranchEventsResponse } from "../types";

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/management.ts
jest.mock("../../../../shared/api/management");

import { getBranchEvents } from "../../../../shared/api/management";
import { useCashRegisterHistory, CASH_REGISTER_PAGE_SIZE } from "./useCashRegisterHistory";

const mockGetBranchEvents = jest.mocked(getBranchEvents);

function makeEvent(id: string): CashRegisterEventTO {
    return {
        id,
        notes: "",
        branchId: "branch-1",
        amount: 10,
        type: CashUpdateType.CASH_IN,
        date: "2026-07-30T10:00:00",
    };
}

function response(events: CashRegisterEventTO[], hasMore: boolean): GetBranchEventsResponse {
    return { events, hasMore };
}

beforeAll(() => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("useCashRegisterHistory", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("initial page-0 load", () => {
        it("should_not_fetch_when_dialog_is_closed", () => {
            renderHook(() => useCashRegisterHistory("branch-1", false));

            expect(mockGetBranchEvents).not.toHaveBeenCalled();
        });

        it("should_fetch_first_page_when_dialog_opens", async () => {
            mockGetBranchEvents.mockResolvedValue(response([makeEvent("1")], false));

            const { result } = renderHook(() => useCashRegisterHistory("branch-1", true));

            await waitFor(() => expect(result.current.loading).toBe(false));

            expect(mockGetBranchEvents).toHaveBeenCalledWith({
                branchId: "branch-1",
                page: 0,
                size: CASH_REGISTER_PAGE_SIZE,
            });
            expect(result.current.events).toHaveLength(1);
        });

        it("should_set_loading_true_when_fetch_is_in_flight", () => {
            mockGetBranchEvents.mockReturnValue(new Promise<GetBranchEventsResponse>(() => {}));

            const { result } = renderHook(() => useCashRegisterHistory("branch-1", true));

            expect(result.current.loading).toBe(true);
        });

        it("should_refetch_page_zero_when_branch_changes", async () => {
            mockGetBranchEvents.mockResolvedValue(response([], false));

            const { result, rerender } = renderHook(
                ({ branchId }: { branchId: string }) => useCashRegisterHistory(branchId, true),
                { initialProps: { branchId: "branch-1" } }
            );

            await waitFor(() => expect(result.current.loading).toBe(false));
            mockGetBranchEvents.mockClear();

            rerender({ branchId: "branch-2" });

            await waitFor(() =>
                expect(mockGetBranchEvents).toHaveBeenCalledWith({
                    branchId: "branch-2",
                    page: 0,
                    size: CASH_REGISTER_PAGE_SIZE,
                })
            );
        });
    });

    describe("loadMore pagination", () => {
        it("should_append_next_page_when_loadMore_is_called", async () => {
            mockGetBranchEvents.mockResolvedValueOnce(response([makeEvent("1")], true));

            const { result } = renderHook(() => useCashRegisterHistory("branch-1", true));
            await waitFor(() => expect(result.current.loading).toBe(false));

            mockGetBranchEvents.mockResolvedValueOnce(response([makeEvent("2")], false));

            await act(async () => {
                result.current.loadMore();
                await Promise.resolve();
            });

            await waitFor(() => expect(result.current.events).toHaveLength(2));
            expect(result.current.events.map(e => e.id)).toEqual(["1", "2"]);
            expect(result.current.hasMore).toBe(false);
        });

        it("should_request_page_one_when_loadMore_is_called", async () => {
            mockGetBranchEvents.mockResolvedValueOnce(response([makeEvent("1")], true));

            const { result } = renderHook(() => useCashRegisterHistory("branch-1", true));
            await waitFor(() => expect(result.current.loading).toBe(false));

            mockGetBranchEvents.mockResolvedValueOnce(response([], false));
            mockGetBranchEvents.mockClear();

            await act(async () => {
                result.current.loadMore();
                await Promise.resolve();
            });

            expect(mockGetBranchEvents).toHaveBeenCalledWith({
                branchId: "branch-1",
                page: 1,
                size: CASH_REGISTER_PAGE_SIZE,
            });
        });

        it("should_not_fetch_when_hasMore_is_false", async () => {
            mockGetBranchEvents.mockResolvedValueOnce(response([makeEvent("1")], false));

            const { result } = renderHook(() => useCashRegisterHistory("branch-1", true));
            await waitFor(() => expect(result.current.loading).toBe(false));
            mockGetBranchEvents.mockClear();

            await act(async () => {
                result.current.loadMore();
                await Promise.resolve();
            });

            expect(mockGetBranchEvents).not.toHaveBeenCalled();
        });

        it("should_issue_a_single_request_when_loadMore_is_called_twice_concurrently", async () => {
            mockGetBranchEvents.mockResolvedValueOnce(response([makeEvent("1")], true));

            const { result } = renderHook(() => useCashRegisterHistory("branch-1", true));
            await waitFor(() => expect(result.current.loading).toBe(false));

            mockGetBranchEvents.mockReturnValue(new Promise<GetBranchEventsResponse>(() => {}));
            mockGetBranchEvents.mockClear();

            act(() => {
                result.current.loadMore();
                result.current.loadMore();
            });

            expect(mockGetBranchEvents).toHaveBeenCalledTimes(1);
        });

        it("should_release_the_lock_when_an_in_flight_page_is_superseded_by_a_branch_change", async () => {
            mockGetBranchEvents.mockResolvedValueOnce(response([makeEvent("1")], true));

            const { result, rerender } = renderHook(
                ({ branchId }: { branchId: string }) => useCashRegisterHistory(branchId, true),
                { initialProps: { branchId: "branch-1" } }
            );
            await waitFor(() => expect(result.current.loading).toBe(false));

            let resolveSuperseded: (value: GetBranchEventsResponse) => void = () => undefined;
            mockGetBranchEvents.mockReturnValueOnce(
                new Promise<GetBranchEventsResponse>(resolve => { resolveSuperseded = resolve; })
            );

            act(() => { result.current.loadMore(); });

            mockGetBranchEvents.mockResolvedValueOnce(response([makeEvent("9")], true));
            rerender({ branchId: "branch-2" });
            await waitFor(() => expect(result.current.loading).toBe(false));

            await act(async () => {
                resolveSuperseded(response([makeEvent("stale")], true));
                await Promise.resolve();
            });

            await waitFor(() => expect(result.current.loadingMore).toBe(false));

            mockGetBranchEvents.mockResolvedValueOnce(response([makeEvent("10")], false));
            await act(async () => {
                result.current.loadMore();
                await Promise.resolve();
            });

            await waitFor(() => expect(result.current.events.map(e => e.id)).toEqual(["9", "10"]));
        });
    });

    describe("reset behaviour", () => {
        it("should_clear_accumulated_events_when_dialog_closes", async () => {
            mockGetBranchEvents.mockResolvedValue(response([makeEvent("1")], true));

            const { result, rerender } = renderHook(
                ({ open }: { open: boolean }) => useCashRegisterHistory("branch-1", open),
                { initialProps: { open: true } }
            );
            await waitFor(() => expect(result.current.events).toHaveLength(1));

            rerender({ open: false });

            expect(result.current.events).toHaveLength(0);
            expect(result.current.hasMore).toBe(true);
        });

        it("should_refetch_page_zero_when_dialog_reopens", async () => {
            mockGetBranchEvents.mockResolvedValue(response([makeEvent("1")], true));

            const { result, rerender } = renderHook(
                ({ open }: { open: boolean }) => useCashRegisterHistory("branch-1", open),
                { initialProps: { open: true } }
            );
            await waitFor(() => expect(result.current.loading).toBe(false));

            mockGetBranchEvents.mockResolvedValueOnce(response([makeEvent("2")], true));

            await act(async () => {
                result.current.loadMore();
                await Promise.resolve();
            });
            await waitFor(() => expect(result.current.events).toHaveLength(2));

            rerender({ open: false });
            mockGetBranchEvents.mockClear();
            rerender({ open: true });

            await waitFor(() => expect(result.current.loading).toBe(false));

            expect(mockGetBranchEvents).toHaveBeenCalledWith({
                branchId: "branch-1",
                page: 0,
                size: CASH_REGISTER_PAGE_SIZE,
            });
            expect(result.current.events.map(e => e.id)).toEqual(["1"]);
        });
    });

    describe("error handling", () => {
        it("should_expose_the_error_when_the_initial_fetch_rejects", async () => {
            mockGetBranchEvents.mockRejectedValueOnce(new Error("Response: 500"));

            const { result } = renderHook(() => useCashRegisterHistory("branch-1", true));

            await waitFor(() => expect(result.current.error).toBe("Response: 500"));
            expect(result.current.loading).toBe(false);
            expect(result.current.events).toHaveLength(0);
        });
    });
});
