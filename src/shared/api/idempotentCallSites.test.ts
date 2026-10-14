import { jest, describe, it, expect, beforeEach, beforeAll } from "@jest/globals";

// Uses the manual mock at __mocks__/client.ts.
jest.mock("./client");

import { authFetch } from "./client";
import { sendOrderPayment } from "./public";
import { cashUpdate, uploadPurchaseInvoiceImage } from "./management";
import { CashUpdateType } from "../../domains/management/cash-register/types";
import { OrderPaymentError } from "../../domains/order/types";

const mockAuthFetch = jest.mocked(authFetch);

type CallArgs = [string, RequestInit, { retryDelaysMs?: number[] } | undefined];

const lastCall = (): CallArgs => mockAuthFetch.mock.calls[0] as CallArgs;

beforeAll(() => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
});

beforeEach(() => {
    mockAuthFetch.mockReset();
});

describe("sendOrderPayment", () => {
    const payment = { orderId: "1", amount: 4.5, type: "Cash" as const, branchId: "2" };

    it("sends idempotency_key in the body and opts into retry when a key is present", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(JSON.stringify({ status: "ok" }), { status: 200 }));

        await sendOrderPayment({ ...payment, idempotency_key: "key-1" });

        const [, init, options] = lastCall();
        expect(JSON.parse(init.body as string)).toMatchObject({ orderId: "1", idempotency_key: "key-1" });
        expect(options?.retryDelaysMs?.length).toBeGreaterThan(0);
    });

    it("does not opt into retry without a key", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(JSON.stringify({ status: "ok" }), { status: 200 }));

        await sendOrderPayment(payment);

        const [, init, options] = lastCall();
        expect(JSON.parse(init.body as string)).not.toHaveProperty("idempotency_key");
        expect(options).toBeUndefined();
    });

    it("resolves with the parsed body on 200", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(JSON.stringify({ status: "ok" }), { status: 200 }));

        await expect(sendOrderPayment({ ...payment, idempotency_key: "key-1" })).resolves.toEqual({ status: "ok" });
    });

    it("rejects with the same error when the request fails", async () => {
        const failure = new TypeError("Failed to fetch");
        mockAuthFetch.mockRejectedValueOnce(failure);

        await expect(sendOrderPayment({ ...payment, idempotency_key: "key-1" })).rejects.toBe(failure);
    });

    it("rejects with OrderPaymentError carrying status and server message on 400", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(JSON.stringify({ message: "Order not found" }), { status: 400 }));

        const error: unknown = await sendOrderPayment({ ...payment, idempotency_key: "key-1" }).catch((e: unknown) => e);

        if (!(error instanceof OrderPaymentError)) throw new Error("expected OrderPaymentError");
        expect(error.status).toBe(400);
        expect(error.message).toBe("Order not found");
    });

    it("rejects with a generic message when the error body is not JSON", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response("<html>bad gateway</html>", { status: 502 }));

        const error: unknown = await sendOrderPayment({ ...payment, idempotency_key: "key-1" }).catch((e: unknown) => e);

        if (!(error instanceof OrderPaymentError)) throw new Error("expected OrderPaymentError");
        expect(error.message).toBe("Payment failed (HTTP 502)");
    });
});

describe("cashUpdate", () => {
    const base = { branchId: "b1", cashUpdateType: CashUpdateType.CASH_IN, amount: 10, note: "float" };

    it("sends the key in the body and opts into retry when a key is present", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));

        await cashUpdate({ ...base, idempotency_key: "k1" });

        const [, init, options] = lastCall();
        expect(JSON.parse(init.body as string)).toMatchObject({ idempotency_key: "k1" });
        expect(options?.retryDelaysMs?.length).toBeGreaterThan(0);
    });

    it("does not opt into retry without a key", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));

        await cashUpdate(base);

        const [, , options] = lastCall();
        expect(options).toBeUndefined();
    });
});

describe("uploadPurchaseInvoiceImage", () => {
    it("opts into retry because the endpoint is an upsert", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));

        await uploadPurchaseInvoiceImage(5, new Blob(["x"]));

        const [, , options] = lastCall();
        expect(options?.retryDelaysMs?.length).toBeGreaterThan(0);
    });
});
