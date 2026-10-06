import {jest, describe, it, expect, beforeAll} from "@jest/globals";
import {renderHook, waitFor} from "@testing-library/react";
import {useDeliveryScopedStats} from "./useDeliveryScopedStats";
import type {DeliveryStatsScope} from "./useStatistics";

type Report = { label: string };

const OCTOBER: DeliveryStatsScope = {startDate: "2026-10-01", finishDate: "2026-10-06"};
const SEPTEMBER: DeliveryStatsScope = {startDate: "2026-09-01", finishDate: "2026-09-30"};

beforeAll(() => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
});

/** A promise the test settles by hand, so two requests can be made to land in either order. */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (err: Error) => void } {
    let resolve: (value: T) => void = () => undefined;
    let reject: (err: Error) => void = () => undefined;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return {promise, resolve, reject};
}

describe("useDeliveryScopedStats", () => {
    it("fetches nothing until a range has been applied", () => {
        const fetcher = jest.fn<Promise<Report>, [string, string]>();

        const {result} = renderHook(() => useDeliveryScopedStats<Report>(null, fetcher));

        expect(fetcher).not.toHaveBeenCalled();
        expect(result.current).toEqual({stats: null, fetchedFor: null, loading: false, failed: false});
    });

    it("fetches the applied range and remembers which range the figures belong to", async () => {
        const fetcher = jest.fn<Promise<Report>, [string, string]>();
        fetcher.mockResolvedValue({label: "october"});

        const {result} = renderHook(() => useDeliveryScopedStats<Report>(OCTOBER, fetcher));

        await waitFor(() => expect(result.current.stats).toEqual({label: "october"}));
        expect(fetcher).toHaveBeenCalledWith("2026-10-01", "2026-10-06");
        expect(result.current.fetchedFor).toBe(OCTOBER);
        expect(result.current.loading).toBe(false);
    });

    /**
     * The older request answering last must not paint its figures under the newer range's label —
     * the same race useDeliveryZoneStats guards.
     */
    it("ignores an answer for a range that is no longer applied", async () => {
        const slow = deferred<Report>();
        const fetcher = jest.fn<Promise<Report>, [string, string]>();
        fetcher.mockImplementation((start) =>
            start === SEPTEMBER.startDate ? slow.promise : Promise.resolve({label: "october"}));

        const {result, rerender} = renderHook(
            ({scope}: { scope: DeliveryStatsScope }) => useDeliveryScopedStats<Report>(scope, fetcher),
            {initialProps: {scope: SEPTEMBER}}
        );
        rerender({scope: OCTOBER});
        await waitFor(() => expect(result.current.stats).toEqual({label: "october"}));

        slow.resolve({label: "september"});
        await slow.promise;

        expect(result.current.stats).toEqual({label: "october"});
        expect(result.current.fetchedFor).toBe(OCTOBER);
    });

    it("keeps the previous figures on screen while a new range loads", async () => {
        const next = deferred<Report>();
        const fetcher = jest.fn<Promise<Report>, [string, string]>();
        fetcher.mockResolvedValueOnce({label: "september"}).mockReturnValueOnce(next.promise);

        const {result, rerender} = renderHook(
            ({scope}: { scope: DeliveryStatsScope }) => useDeliveryScopedStats<Report>(scope, fetcher),
            {initialProps: {scope: SEPTEMBER}}
        );
        await waitFor(() => expect(result.current.stats).toEqual({label: "september"}));

        rerender({scope: OCTOBER});

        await waitFor(() => expect(result.current.loading).toBe(true));
        expect(result.current.stats).toEqual({label: "september"});
        expect(result.current.fetchedFor).toBe(SEPTEMBER);
        next.resolve({label: "october"});
        await waitFor(() => expect(result.current.fetchedFor).toBe(OCTOBER));
    });

    /** A failure drops the old figures: they belong to a range the controls no longer show. */
    it("reports a failure and drops the previous figures", async () => {
        const fetcher = jest.fn<Promise<Report>, [string, string]>();
        fetcher.mockResolvedValueOnce({label: "september"}).mockRejectedValueOnce(new Error("HTTP 500"));

        const {result, rerender} = renderHook(
            ({scope}: { scope: DeliveryStatsScope }) => useDeliveryScopedStats<Report>(scope, fetcher),
            {initialProps: {scope: SEPTEMBER}}
        );
        await waitFor(() => expect(result.current.stats).not.toBeNull());

        rerender({scope: OCTOBER});

        await waitFor(() => expect(result.current.failed).toBe(true));
        expect(result.current.stats).toBeNull();
        expect(result.current.fetchedFor).toBeNull();
    });

    /** Switching a report off (a null scope) resets it, so switching it back on fetches afresh. */
    it("resets when the scope is withdrawn", async () => {
        const fetcher = jest.fn<Promise<Report>, [string, string]>();
        fetcher.mockResolvedValue({label: "october"});

        const initialProps: { scope: DeliveryStatsScope | null } = {scope: OCTOBER};
        const {result, rerender} = renderHook(
            ({scope}: { scope: DeliveryStatsScope | null }) => useDeliveryScopedStats<Report>(scope, fetcher),
            {initialProps}
        );
        await waitFor(() => expect(result.current.stats).not.toBeNull());

        rerender({scope: null});

        expect(result.current.stats).toBeNull();
        expect(result.current.fetchedFor).toBeNull();
    });
});
