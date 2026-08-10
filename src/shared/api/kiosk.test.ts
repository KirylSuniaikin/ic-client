import { jest, describe, it, expect, beforeEach, afterEach, beforeAll } from "@jest/globals";
import {
    fetchPairingOptions,
    createKioskOrder,
    initiateKioskPayment,
    fetchKioskPaymentResult,
    cancelKioskPayment,
    deferOrderToCounter,
    abandonKioskOrder,
    PairingUnavailableError,
} from "./kiosk";
import { KioskHttpError } from "./kioskClient";
import { ItemsUnavailableError, BranchClosedError } from "../../domains/order/types";
import type { CreateOrderRequest } from "../../domains/order/types";
import { setKioskDeviceName } from "../../domains/kiosk/services/kioskIdentity";

// kiosk.ts's functions call kioskFetch, which itself calls global fetch — mocking fetch directly
// (rather than mocking ./kioskClient) exercises the real kioskFetch header/error logic together
// with each endpoint function's own status handling, mirroring public.test.ts's
// fetchBaseAppInfo describe block (which mocks raw fetch for the same reason: no intermediate
// wrapper to substitute).

beforeAll(() => {
    Object.defineProperty(window, "location", {
        writable: true,
        configurable: true,
        value: { href: "" },
    });
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("kiosk.ts", () => {
    let mockFetch = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
    let savedFetch: typeof globalThis.fetch;

    beforeEach(() => {
        savedFetch = global.fetch;
        mockFetch = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
        global.fetch = mockFetch as typeof fetch;
        localStorage.clear();
        setKioskDeviceName("kiosk-1");
    });

    afterEach(() => {
        global.fetch = savedFetch;
        localStorage.clear();
    });

    // ── fetchPairingOptions ──────────────────────────────────────────────────

    describe("fetchPairingOptions", () => {
        it("calls GET on the pairing kiosks endpoint", async () => {
            mockFetch.mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));

            await fetchPairingOptions();

            const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(url).toContain("/kiosk/pairing/kiosks");
            expect(init.method).toBe("GET");
        });

        it("sends no X-Kiosk-Name header even when a device is already paired", async () => {
            mockFetch.mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));

            await fetchPairingOptions();

            const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
            const headers = new Headers(init?.headers);
            expect(headers.has("X-Kiosk-Name")).toBe(false);
        });

        it("still sends X-Client-Platform: kiosk-web", async () => {
            mockFetch.mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));

            await fetchPairingOptions();

            const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
            const headers = new Headers(init?.headers);
            expect(headers.get("X-Client-Platform")).toBe("kiosk-web");
        });

        it("returns the parsed pairing list", async () => {
            const kiosks = [{ deviceName: "kiosk-1", terminalId: "t1", branchId: "b1", branchName: "Main" }];
            mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(kiosks), { status: 200 }));

            const result = await fetchPairingOptions();

            expect(result).toEqual(kiosks);
        });

        it.each([401, 403, 404])("throws PairingUnavailableError on a %d response", async (status) => {
            mockFetch.mockResolvedValueOnce(new Response(null, { status }));

            await expect(fetchPairingOptions()).rejects.toBeInstanceOf(PairingUnavailableError);
        });

        it("throws a non-PairingUnavailableError on other non-ok statuses", async () => {
            mockFetch.mockResolvedValueOnce(new Response(null, { status: 500 }));

            let caught: unknown;
            try {
                await fetchPairingOptions();
            } catch (err) {
                caught = err;
            }

            expect(caught).toBeInstanceOf(Error);
            expect(caught).not.toBeInstanceOf(PairingUnavailableError);
        });
    });

    // ── createKioskOrder ─────────────────────────────────────────────────────

    describe("createKioskOrder", () => {
        const order: CreateOrderRequest = {
            tel: "97312345678",
            customer_name: null,
            type: "Pick Up",
            payment_type: "Card",
            branchId: "branch-1",
            notes: "",
            items: [],
            amount_paid: 0,
        };

        it("calls POST on the kiosk orders endpoint", async () => {
            mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ id: 1 }), { status: 200 }));

            await createKioskOrder(order);

            const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(url).toContain("/kiosk/orders");
            expect(init.method).toBe("POST");
        });

        it("attaches the X-Kiosk-Name header", async () => {
            mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ id: 1 }), { status: 200 }));

            await createKioskOrder(order);

            const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
            const headers = new Headers(init?.headers);
            expect(headers.get("X-Kiosk-Name")).toBe("kiosk-1");
        });

        it("serialises the order as JSON in the request body", async () => {
            mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ id: 1 }), { status: 200 }));

            await createKioskOrder(order);

            const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
            const parsed = JSON.parse(init.body as string) as CreateOrderRequest;
            expect(parsed.customer_name).toBeNull();
            expect(parsed.type).toBe("Pick Up");
        });

        it("throws ItemsUnavailableError carrying unavailableIds on 409", async () => {
            const body = JSON.stringify({ message: "items unavailable", unavailableIds: [1, 2] });
            mockFetch.mockResolvedValueOnce(
                new Response(body, { status: 409, headers: { "Content-Type": "application/json" } })
            );

            let caught: unknown;
            try {
                await createKioskOrder(order);
            } catch (err) {
                caught = err;
            }

            expect(caught).toBeInstanceOf(ItemsUnavailableError);
            expect((caught as ItemsUnavailableError).unavailableIds).toEqual([1, 2]);
        });

        it("throws BranchClosedError on 423", async () => {
            const body = JSON.stringify({ message: "We're sorry, this branch is closed right now." });
            mockFetch.mockResolvedValueOnce(
                new Response(body, { status: 423, headers: { "Content-Type": "application/json" } })
            );

            let caught: unknown;
            try {
                await createKioskOrder(order);
            } catch (err) {
                caught = err;
            }

            expect(caught).toBeInstanceOf(BranchClosedError);
            expect((caught as BranchClosedError).message).toBe("We're sorry, this branch is closed right now.");
        });

        it("throws a plain KioskHttpError (not a domain error) on other non-ok statuses", async () => {
            mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ message: "boom" }), {
                status: 500,
                headers: { "Content-Type": "application/json" },
            }));

            let caught: unknown;
            try {
                await createKioskOrder(order);
            } catch (err) {
                caught = err;
            }

            expect(caught).toBeInstanceOf(KioskHttpError);
            expect(caught).not.toBeInstanceOf(ItemsUnavailableError);
            expect(caught).not.toBeInstanceOf(BranchClosedError);
        });

        it("returns the parsed order on success", async () => {
            mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ id: 1 }), { status: 200 }));

            const result = await createKioskOrder(order);

            expect(result).toEqual({ id: 1 });
        });
    });

    // ── initiateKioskPayment ─────────────────────────────────────────────────

    describe("initiateKioskPayment", () => {
        it("calls POST on the initiate endpoint with a numeric orderId body", async () => {
            mockFetch.mockResolvedValueOnce(
                new Response(JSON.stringify({ invoiceNum: "inv-1", status: "PENDING" }), { status: 200 })
            );

            await initiateKioskPayment("42");

            const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(url).toContain("/kiosk/payments/initiate");
            expect(init.method).toBe("POST");
            expect(JSON.parse(init.body as string)).toEqual({ orderId: 42 });
        });

        it("returns the parsed initiate response", async () => {
            mockFetch.mockResolvedValueOnce(
                new Response(JSON.stringify({ invoiceNum: "inv-1", status: "PENDING" }), { status: 200 })
            );

            const result = await initiateKioskPayment("42");

            expect(result).toEqual({ invoiceNum: "inv-1", status: "PENDING" });
        });
    });

    // ── fetchKioskPaymentResult ──────────────────────────────────────────────

    describe("fetchKioskPaymentResult", () => {
        it("calls GET on the result endpoint for the given invoice", async () => {
            mockFetch.mockResolvedValueOnce(
                new Response(JSON.stringify({ invoiceNum: "inv-1", status: "APPROVED" }), { status: 200 })
            );

            await fetchKioskPaymentResult("inv-1");

            const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(url).toContain("/kiosk/payments/inv-1/result");
            expect(init.method).toBe("GET");
        });

        it("returns the parsed payment result", async () => {
            const resultBody = { invoiceNum: "inv-1", status: "APPROVED", orderId: 1, amount: "5.500" };
            mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(resultBody), { status: 200 }));

            const result = await fetchKioskPaymentResult("inv-1");

            expect(result).toEqual(resultBody);
        });
    });

    // ── cancelKioskPayment ───────────────────────────────────────────────────

    describe("cancelKioskPayment", () => {
        it("calls POST on the cancel endpoint for the given invoice", async () => {
            mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

            await cancelKioskPayment("inv-1");

            const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(url).toContain("/kiosk/payments/inv-1/cancel");
            expect(init.method).toBe("POST");
        });
    });

    // ── deferOrderToCounter ──────────────────────────────────────────────────

    describe("deferOrderToCounter", () => {
        it("calls POST on the defer-to-counter endpoint", async () => {
            mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

            await deferOrderToCounter("42");

            const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(url).toContain("/kiosk/orders/42/defer-to-counter");
            expect(init.method).toBe("POST");
        });

        it("surfaces a 409 (late approval after decline) as KioskHttpError(409, ...)", async () => {
            mockFetch.mockResolvedValueOnce(
                new Response(JSON.stringify({ message: "already paid" }), {
                    status: 409,
                    headers: { "Content-Type": "application/json" },
                })
            );

            let caught: unknown;
            try {
                await deferOrderToCounter("42");
            } catch (err) {
                caught = err;
            }

            expect(caught).toBeInstanceOf(KioskHttpError);
            expect((caught as KioskHttpError).status).toBe(409);
        });
    });

    // ── abandonKioskOrder ────────────────────────────────────────────────────

    describe("abandonKioskOrder", () => {
        it("calls POST on the abandon endpoint", async () => {
            mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

            await abandonKioskOrder("42");

            const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(url).toContain("/kiosk/orders/42/abandon");
            expect(init.method).toBe("POST");
        });

        it("surfaces a 404 (not idempotent — second call) as KioskHttpError(404, ...)", async () => {
            mockFetch.mockResolvedValueOnce(new Response(null, { status: 404 }));

            let caught: unknown;
            try {
                await abandonKioskOrder("42");
            } catch (err) {
                caught = err;
            }

            expect(caught).toBeInstanceOf(KioskHttpError);
            expect((caught as KioskHttpError).status).toBe(404);
        });
    });
});
