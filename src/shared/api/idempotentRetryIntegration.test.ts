import { jest, describe, it, expect, beforeEach, afterEach, beforeAll } from "@jest/globals";

// Real authFetch + real call sites; only the network (global fetch) is mocked.
import { sendOrderPayment, getAllActiveOrders } from "./public";
import { cashUpdate } from "./management";
import { CashUpdateType } from "../../domains/management/cash-register/types";
import { OrderPaymentError } from "../../domains/order/types";

const realRandom = Math.random;
const realFetch = global.fetch;
const mockFetch = jest.fn<Promise<Response>, Parameters<typeof fetch>>();

function bodyOf(callIndex: number): Record<string, unknown> {
    const [, init] = mockFetch.mock.calls[callIndex] as [string, RequestInit];
    return JSON.parse(init.body as string) as Record<string, unknown>;
}

beforeAll(() => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    jest.spyOn(console, "log").mockImplementation(() => undefined);
});

beforeEach(() => {
    mockFetch.mockReset();
    // Cast: jest.Mock carries extra mock members beyond the fetch call signature.
    global.fetch = mockFetch as typeof fetch;
    // Zero jitter: retry sleeps 0 ms.
    Math.random = () => 0;
});

afterEach(() => {
    global.fetch = realFetch;
    Math.random = realRandom;
});

describe("sendOrderPayment retry", () => {
    const payment = { orderId: "1", amount: 4.5, type: "Cash" as const, branchId: "2" };

    it("resends the identical key after a transient network failure", async () => {
        mockFetch
            .mockRejectedValueOnce(new TypeError("Failed to fetch"))
            .mockResolvedValueOnce(new Response(JSON.stringify({ status: "ok" }), { status: 200 }));

        const result = await sendOrderPayment({ ...payment, idempotency_key: "leg-1" });

        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(bodyOf(0).idempotency_key).toBe("leg-1");
        expect(bodyOf(1).idempotency_key).toBe("leg-1");
        expect(result).toEqual({ status: "ok" });
    });

    it("does not retry a keyless payment", async () => {
        mockFetch.mockRejectedValue(new TypeError("Failed to fetch"));

        await expect(sendOrderPayment(payment)).rejects.toThrow();

        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("does not retry a 400 even with a key", async () => {
        mockFetch.mockResolvedValue(new Response(JSON.stringify({ message: "bad" }), { status: 400 }));

        await expect(sendOrderPayment({ ...payment, idempotency_key: "leg-1" })).rejects.toBeInstanceOf(OrderPaymentError);

        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("rejects with OrderPaymentError(503) after exhausting retries, resending the same key", async () => {
        mockFetch.mockImplementation(() => Promise.resolve(new Response("{}", { status: 503 })));

        const error: unknown = await sendOrderPayment({ ...payment, idempotency_key: "leg-1" }).catch((e: unknown) => e);

        if (!(error instanceof OrderPaymentError)) throw new Error("expected OrderPaymentError");
        expect(error.status).toBe(503);
        expect(mockFetch).toHaveBeenCalledTimes(4);
        [0, 1, 2, 3].forEach(i => expect(bodyOf(i).idempotency_key).toBe("leg-1"));
    });
});

describe("cashUpdate retry", () => {
    const base = { branchId: "b1", cashUpdateType: CashUpdateType.CASH_IN, amount: 10, note: "float" };

    it("resends the identical key after a 503", async () => {
        mockFetch
            .mockResolvedValueOnce(new Response("{}", { status: 503 }))
            .mockResolvedValueOnce(new Response("{}", { status: 200 }));

        const resp = await cashUpdate({ ...base, idempotency_key: "k1" });

        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(bodyOf(0).idempotency_key).toBe("k1");
        expect(bodyOf(1).idempotency_key).toBe("k1");
        expect(resp.status).toBe(200);
    });

    it("does not retry a keyless 503", async () => {
        mockFetch.mockResolvedValue(new Response("{}", { status: 503 }));

        await cashUpdate(base);

        expect(mockFetch).toHaveBeenCalledTimes(1);
    });
});

describe("getAllActiveOrders retry", () => {
    it("retries once after a transient failure and then succeeds", async () => {
        mockFetch
            .mockRejectedValueOnce(new TypeError("Failed to fetch"))
            .mockResolvedValueOnce(new Response("[]", { status: 200 }));

        const orders = await getAllActiveOrders("branch-1");

        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(orders).toEqual([]);
    });
});
