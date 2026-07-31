import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import React from "react";
import { render, screen } from "@testing-library/react";
import { CashUpdateType } from "../types";
import type { CashRegisterEventTO } from "../types";
import type { UseCashRegisterHistoryResult } from "../hooks/useCashRegisterHistory";

// The hook owns all fetch/pagination logic; the component test controls it directly.
jest.mock("../hooks/useCashRegisterHistory");

import { useCashRegisterHistory } from "../hooks/useCashRegisterHistory";
import TransactionDetailsTable from "./TransactionDetailsTable";

const mockUseCashRegisterHistory = jest.mocked(useCashRegisterHistory);

function makeEvent(id: string, type: CashUpdateType): CashRegisterEventTO {
    return {
        id,
        notes: "",
        branchId: "branch-1",
        amount: 10,
        type,
        date: "2026-07-30T10:00:00",
    };
}

function hookResult(overrides: Partial<UseCashRegisterHistoryResult> = {}): UseCashRegisterHistoryResult {
    return {
        events: [],
        loading: false,
        loadingMore: false,
        hasMore: false,
        error: null,
        loadMore: jest.fn<void, []>(),
        ...overrides,
    };
}

// Captures the callback passed to `new IntersectionObserver(cb)` so tests can fire it
// manually to simulate the sentinel scrolling into view.
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

function renderTable(open: boolean = true): ReturnType<typeof render> {
    return render(
        <TransactionDetailsTable branchId="branch-1" open={open} onClose={jest.fn<void, []>()} />
    );
}

describe("TransactionDetailsTable", () => {
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

    describe("infinite scroll sentinel", () => {
        it("should_not_observe_when_the_initial_page_is_still_loading", () => {
            mockUseCashRegisterHistory.mockReturnValue(hookResult({ loading: true, hasMore: true }));

            renderTable();

            expect(observeSpy).not.toHaveBeenCalled();
        });

        it("should_observe_the_sentinel_when_the_initial_page_has_loaded", () => {
            mockUseCashRegisterHistory.mockReturnValue(
                hookResult({ events: [makeEvent("1", CashUpdateType.CASH_IN)], hasMore: true })
            );

            renderTable();

            expect(observeSpy).toHaveBeenCalledTimes(1);
        });

        it("should_not_observe_when_there_are_no_more_pages", () => {
            mockUseCashRegisterHistory.mockReturnValue(
                hookResult({ events: [makeEvent("1", CashUpdateType.CASH_IN)], hasMore: false })
            );

            renderTable();

            expect(observeSpy).not.toHaveBeenCalled();
        });

        it("should_not_observe_when_the_dialog_is_closed", () => {
            mockUseCashRegisterHistory.mockReturnValue(
                hookResult({ events: [makeEvent("1", CashUpdateType.CASH_IN)], hasMore: true })
            );

            renderTable(false);

            expect(observeSpy).not.toHaveBeenCalled();
        });

        it("should_call_loadMore_when_the_sentinel_becomes_intersecting", () => {
            const loadMore = jest.fn<void, []>();
            mockUseCashRegisterHistory.mockReturnValue(
                hookResult({ events: [makeEvent("1", CashUpdateType.CASH_IN)], hasMore: true, loadMore })
            );

            renderTable();
            capturedObserverCallback!(
                [{ isIntersecting: true } as IntersectionObserverEntry],
                {} as IntersectionObserver
            );

            expect(loadMore).toHaveBeenCalledTimes(1);
        });

        it("should_not_call_loadMore_when_the_sentinel_is_not_intersecting", () => {
            const loadMore = jest.fn<void, []>();
            mockUseCashRegisterHistory.mockReturnValue(
                hookResult({ events: [makeEvent("1", CashUpdateType.CASH_IN)], hasMore: true, loadMore })
            );

            renderTable();
            capturedObserverCallback!(
                [{ isIntersecting: false } as IntersectionObserverEntry],
                {} as IntersectionObserver
            );

            expect(loadMore).not.toHaveBeenCalled();
        });

        it("should_not_retry_the_failed_page_when_the_fetch_errored", () => {
            mockUseCashRegisterHistory.mockReturnValue(
                hookResult({ hasMore: true, error: "Response: 500" })
            );

            renderTable();

            expect(observeSpy).not.toHaveBeenCalled();
            expect(screen.getByText("Failed to load transactions")).toBeTruthy();
        });
    });

    describe("empty state", () => {
        it("should_show_the_empty_message_when_the_server_confirmed_no_events", () => {
            mockUseCashRegisterHistory.mockReturnValue(hookResult({ events: [], hasMore: false }));

            renderTable();

            expect(screen.getByText("No transactions found")).toBeTruthy();
        });

        it("should_not_show_the_empty_message_before_the_first_page_resolves", () => {
            mockUseCashRegisterHistory.mockReturnValue(hookResult({ events: [], hasMore: true }));

            renderTable();

            expect(screen.queryByText("No transactions found")).toBeNull();
        });
    });

    describe("amount rendering", () => {
        it("should_prefix_a_plus_when_the_event_is_cash_in", () => {
            mockUseCashRegisterHistory.mockReturnValue(
                hookResult({ events: [makeEvent("1", CashUpdateType.CASH_IN)] })
            );

            renderTable();

            expect(screen.getByText("+10")).toBeTruthy();
        });

        it("should_prefix_a_minus_when_the_event_is_cash_out", () => {
            mockUseCashRegisterHistory.mockReturnValue(
                hookResult({ events: [makeEvent("1", CashUpdateType.CASH_OUT)] })
            );

            renderTable();

            expect(screen.getByText("-10")).toBeTruthy();
        });

        it("should_render_no_prefix_when_the_event_is_a_shift_cash_check", () => {
            mockUseCashRegisterHistory.mockReturnValue(
                hookResult({ events: [makeEvent("1", CashUpdateType.CLOSE_SHIFT_CASH_CHECK)] })
            );

            renderTable();

            expect(screen.getByText("10")).toBeTruthy();
        });
    });

    describe("pagination wiring", () => {
        it("should_render_every_accumulated_event_across_pages", () => {
            mockUseCashRegisterHistory.mockReturnValue(
                hookResult({
                    events: Array.from({ length: 60 }, (_, i) => makeEvent(String(i), CashUpdateType.CASH_IN)),
                    hasMore: true,
                })
            );

            renderTable();

            expect(screen.getAllByText("+10")).toHaveLength(60);
        });
    });
});
