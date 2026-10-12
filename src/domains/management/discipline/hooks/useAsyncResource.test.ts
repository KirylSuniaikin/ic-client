import { jest, describe, it, expect } from "@jest/globals";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useAsyncResource } from "./useAsyncResource";

type Deferred<T> = { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void };
function deferred<T>(): Deferred<T> {
    let resolve!: (v: T) => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

describe("useAsyncResource", () => {
    it("is idle on a null key and never calls the loader", () => {
        const load = jest.fn<Promise<string>, []>();

        const { result } = renderHook(() => useAsyncResource<string>(null, load));

        expect(load).not.toHaveBeenCalled();
        expect(result.current).toMatchObject({ data: null, loading: false, error: null });
    });

    it("loads data for a key", async () => {
        const { result } = renderHook(() => useAsyncResource("a", () => Promise.resolve("A")));

        expect(result.current.loading).toBe(true);
        await waitFor(() => expect(result.current.data).toBe("A"));
        expect(result.current.loading).toBe(false);
    });

    it("clears data at once on a key change and refetches", async () => {
        const second = deferred<string>();
        const loads: Record<string, Promise<string>> = { a: Promise.resolve("A"), b: second.promise };
        const { result, rerender } = renderHook(({ k }) => useAsyncResource(k, () => loads[k]), {
            initialProps: { k: "a" },
        });
        await waitFor(() => expect(result.current.data).toBe("A"));

        rerender({ k: "b" });

        expect(result.current.data).toBeNull();
        expect(result.current.loading).toBe(true);
        await act(async () => second.resolve("B"));
        await waitFor(() => expect(result.current.data).toBe("B"));
    });

    it("ignores a stale response from an earlier key", async () => {
        const first = deferred<string>();
        const second = deferred<string>();
        const loads: Record<string, Promise<string>> = { a: first.promise, b: second.promise };
        const { result, rerender } = renderHook(({ k }) => useAsyncResource(k, () => loads[k]), {
            initialProps: { k: "a" },
        });

        rerender({ k: "b" });
        await act(async () => second.resolve("B"));
        await waitFor(() => expect(result.current.data).toBe("B"));
        await act(async () => first.resolve("A"));

        expect(result.current.data).toBe("B");
    });

    it("keeps old data visible while refresh is loading", async () => {
        const next = deferred<string>();
        const load = jest.fn<Promise<string>, []>()
            .mockResolvedValueOnce("first")
            .mockReturnValueOnce(next.promise);
        const { result } = renderHook(() => useAsyncResource("k", load));
        await waitFor(() => expect(result.current.data).toBe("first"));

        act(() => result.current.refresh());

        await waitFor(() => expect(result.current.loading).toBe(true));
        expect(result.current.data).toBe("first");
        await act(async () => next.resolve("second"));
        await waitFor(() => expect(result.current.data).toBe("second"));
        expect(load).toHaveBeenCalledTimes(2);
    });

    it("passes an Error message through without throwing into render", async () => {
        const { result } = renderHook(() => useAsyncResource("k", () => Promise.reject(new Error("boom"))));

        await waitFor(() => expect(result.current.error).toBe("boom"));
        expect(result.current.data).toBeNull();
        expect(result.current.loading).toBe(false);
    });

    it("uses the fallback message for a non-Error rejection", async () => {
        const { result } = renderHook(() => useAsyncResource("k", () => Promise.reject("nope")));

        await waitFor(() => expect(result.current.error).toBe("Failed to load discipline data"));
    });
});
