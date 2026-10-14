import { jest, describe, it, expect, beforeEach, afterEach, beforeAll } from "@jest/globals";
import { BASE_URL } from "./client";
import { getDeliveryAvailability, listAddresses, createAddress, updateAddress, payForDelivery,
    reportKeetaFallbackChosen } from "./delivery";
import { DeliveryApiError } from "../../domains/delivery/types";
import { CLIENT_PLATFORM_HEADER } from "./clientPlatform";
import { DEMAND_SESSION_HEADER, getDemandSessionId } from "./demandSession";

beforeAll(() => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
});

// Module-level mock, mirroring customerAuth.test.ts / client.test.ts.
let mockFetch = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
let savedFetch: typeof globalThis.fetch;

beforeEach(() => {
    savedFetch = global.fetch;
    mockFetch = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
    global.fetch = mockFetch as typeof fetch;
});

afterEach(() => {
    global.fetch = savedFetch;
});

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

describe("getDeliveryAvailability", () => {
    // The early cart pass runs before a guest has a token, so this must not send one.
    it("omits the pin and any Authorization header on the early cart pass", async () => {
        mockFetch.mockResolvedValueOnce(jsonResponse({ available: true, reason: null, branchId: null,
            etaMinutesMin: null, etaMinutesMax: null }));

        await getDeliveryAvailability();

        const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toBe(`${BASE_URL}/delivery/availability`);
        expect(init.method).toBe("GET");
        expect(new Headers(init.headers).has("Authorization")).toBe(false);
    });

    /**
     * The lost-demand figures split refusals by platform and count one customer retrying the same
     * address once. Both depend on these two headers reaching the server on every check.
     */
    it("sends the platform and the demand session on the GET", async () => {
        mockFetch.mockResolvedValueOnce(jsonResponse({ available: true, reason: null, branchId: null,
            etaMinutesMin: null, etaMinutesMax: null }));

        await getDeliveryAvailability({ latitude: 26.2285, longitude: 50.586 });

        const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
        const headers = new Headers(init.headers);
        expect(headers.get(CLIENT_PLATFORM_HEADER)).toBe("web");
        expect(headers.get(DEMAND_SESSION_HEADER)).toBe(getDemandSessionId());
    });

    it("sends the platform and the demand session on the basket POST", async () => {
        mockFetch.mockResolvedValueOnce(jsonResponse({ available: true, reason: null, branchId: null,
            etaMinutesMin: null, etaMinutesMax: null }));

        await getDeliveryAvailability(undefined, [{ id: 7, quantity: 2, isThinDough: false }]);

        const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
        const headers = new Headers(init.headers);
        expect(headers.get("Content-Type")).toBe("application/json");
        expect(headers.get(CLIENT_PLATFORM_HEADER)).toBe("web");
        expect(headers.get(DEMAND_SESSION_HEADER)).toBe(getDemandSessionId());
        expect(headers.has("Authorization")).toBe(false);
    });

    /** Two checks in one tab are one browsing session; a fresh token per call would defeat the dedupe. */
    it("sends the same demand session on every check in a tab", async () => {
        mockFetch.mockResolvedValue(jsonResponse({ available: true, reason: null, branchId: null,
            etaMinutesMin: null, etaMinutesMax: null }));

        await getDeliveryAvailability();
        mockFetch.mockResolvedValue(jsonResponse({ available: true, reason: null, branchId: null,
            etaMinutesMin: null, etaMinutesMax: null }));
        await getDeliveryAvailability({ latitude: 26.2285, longitude: 50.586 });

        const first = new Headers((mockFetch.mock.calls[0] as [string, RequestInit])[1].headers);
        const second = new Headers((mockFetch.mock.calls[1] as [string, RequestInit])[1].headers);
        expect(first.get(DEMAND_SESSION_HEADER)).toBe(second.get(DEMAND_SESSION_HEADER));
    });

    it("sends lat and lng together once a pin exists", async () => {
        mockFetch.mockResolvedValueOnce(jsonResponse({ available: true, reason: null, branchId: "b1",
            etaMinutesMin: 20, etaMinutesMax: 30 }));

        await getDeliveryAvailability({ latitude: 26.2285, longitude: 50.586 });

        const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toBe(`${BASE_URL}/delivery/availability?lat=26.2285&lng=50.586`);
    });

    it("keeps the plain GET for an empty basket", async () => {
        mockFetch.mockResolvedValueOnce(jsonResponse({ available: true, reason: null, branchId: null,
            etaMinutesMin: null, etaMinutesMax: null }));

        await getDeliveryAvailability({ latitude: 26.2285, longitude: 50.586 }, []);

        const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toBe(`${BASE_URL}/delivery/availability?lat=26.2285&lng=50.586`);
        expect(init.method).toBe("GET");
    });

    it("POSTs the pin and the basket as JSON when a basket is given", async () => {
        mockFetch.mockResolvedValueOnce(jsonResponse({ available: false, reason: "INSUFFICIENT_COURIERS",
            branchId: "b1", etaMinutesMin: null, etaMinutesMax: null }));
        const basket = [{ id: 7, quantity: 9, isThinDough: false,
            comboItems: [{ id: 40, quantity: 1, isThinDough: true }] }];

        const result = await getDeliveryAvailability({ latitude: 26.2285, longitude: 50.586 }, basket);

        const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toBe(`${BASE_URL}/delivery/availability`);
        expect(init.method).toBe("POST");
        expect(new Headers(init.headers).get("Content-Type")).toBe("application/json");
        expect(JSON.parse(init.body as string)).toEqual({ lat: 26.2285, lng: 50.586, items: basket });
        expect(result.reason).toBe("INSUFFICIENT_COURIERS");
    });

    it("POSTs a basket with no pin for the cart pass", async () => {
        mockFetch.mockResolvedValueOnce(jsonResponse({ available: true, reason: null, branchId: null,
            etaMinutesMin: null, etaMinutesMax: null }));

        await getDeliveryAvailability(undefined, [{ id: 7, quantity: 2, isThinDough: false }]);

        const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
        expect(JSON.parse(init.body as string)).toEqual({ items: [{ id: 7, quantity: 2, isThinDough: false }] });
    });

    it("throws a DeliveryApiError when the POST is rejected", async () => {
        mockFetch.mockResolvedValueOnce(jsonResponse({ message: "Too many items" }, 400));

        await expect(getDeliveryAvailability(undefined, [{ id: 1, quantity: 1, isThinDough: false }]))
            .rejects.toBeInstanceOf(DeliveryApiError);
    });

    /**
     * A refusal is a 200 with a reason, never an HTTP error — the caller renders the Keeta card
     * from it (§1.2). Throwing here would turn an expected outcome into an error path.
     */
    it("returns an unavailable result rather than throwing", async () => {
        mockFetch.mockResolvedValueOnce(jsonResponse({ available: false, reason: "OUTSIDE_RADIUS",
            branchId: "b1", etaMinutesMin: null, etaMinutesMax: null }));

        const result = await getDeliveryAvailability({ latitude: 26.9, longitude: 50.5 });

        expect(result.available).toBe(false);
        expect(result.reason).toBe("OUTSIDE_RADIUS");
    });

    it("throws DeliveryApiError with the server message on a 4xx", async () => {
        mockFetch.mockResolvedValueOnce(jsonResponse({ message: "Invalid coordinates" }, 400));

        // The message half of this assertion is the point: a generic "Request failed with status
        // 400" would tell the customer nothing, and the server's own wording is what the caller
        // renders inline.
        await expect(getDeliveryAvailability({ latitude: 91, longitude: 50 }))
            .rejects.toMatchObject({ name: "DeliveryApiError", message: "Invalid coordinates", status: 400 });
    });

    /**
     * A body that is not JSON (an HTML error page from a proxy, or an empty 502) must still
     * produce a readable error rather than a parse crash inside the error path.
     */
    it("falls back to a status message when the error body is not JSON", async () => {
        mockFetch.mockResolvedValueOnce(new Response("<html>502</html>", { status: 502 }));

        await expect(getDeliveryAvailability())
            .rejects.toMatchObject({ message: "Request failed with status 502", status: 502 });
    });
});

describe("listAddresses", () => {
    it("sends the bearer token", async () => {
        mockFetch.mockResolvedValueOnce(jsonResponse([]));

        await listAddresses("tok-1");

        const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toBe(`${BASE_URL}/customer/addresses`);
        expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok-1");
    });

    it("surfaces the status on a 401 so callers can treat a lapsed session as 'no addresses'", async () => {
        mockFetch.mockResolvedValueOnce(jsonResponse({ message: "Unauthorized" }, 401));

        await expect(listAddresses("stale")).rejects.toMatchObject({ status: 401 });
    });
});

describe("createAddress", () => {
    it("posts the pin and the Bahrain parts", async () => {
        mockFetch.mockResolvedValueOnce(jsonResponse({ id: "a1" }, 201));

        await createAddress("tok-1", {
            label: "Home", block: "338", road: "3801", building: "12", flat: null, note: null,
            latitude: 26.2285, longitude: 50.586,
        });

        const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
        expect(init.method).toBe("POST");
        const body = JSON.parse(init.body as string);
        expect(body.latitude).toBe(26.2285);
        expect(body.block).toBe("338");
        // The owner is taken from the token server-side; sending one would be a red flag.
        expect(body.accountId).toBeUndefined();
    });

    /**
     * The server deduplicates: a re-save of the same doorstep comes back 200 with the address the
     * customer already had, not 201. Both are successes carrying an address, so this must not
     * treat the 200 as anything special.
     */
    it("returns the existing address when the server deduplicates a re-save", async () => {
        mockFetch.mockResolvedValueOnce(jsonResponse({ id: "already-saved" }, 200));

        await expect(createAddress("tok-1", {
            label: null, block: null, road: null, building: null, flat: null, note: null,
            latitude: 26.2285, longitude: 50.586,
        })).resolves.toMatchObject({ id: "already-saved" });
    });
});

describe("updateAddress", () => {
    it("patches only the text of one address", async () => {
        mockFetch.mockResolvedValueOnce(jsonResponse({ id: "a1" }, 200));

        await updateAddress("tok-1", "a1", {
            label: "Mum's", block: "338", road: "3801", building: "14", flat: null, note: null,
        });

        const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toContain("/customer/addresses/a1");
        expect(init.method).toBe("PATCH");
        const body = JSON.parse(init.body as string);
        expect(body.building).toBe("14");
        // The pin drives routing, the radius check and the ETA, and an order may already be out
        // against this row — the edit endpoint must not be able to move it.
        expect(body.latitude).toBeUndefined();
        expect(body.longitude).toBeUndefined();
    });

    /** 409 = the edit would collide with another saved address. Callers surface it inline. */
    it("surfaces the status on a conflict", async () => {
        mockFetch.mockResolvedValueOnce(jsonResponse({ message: "You already have this address saved" }, 409));

        await expect(updateAddress("tok-1", "a1", {
            label: null, block: null, road: null, building: null, flat: "4", note: null,
        })).rejects.toMatchObject({ status: 409, message: "You already have this address saved" });
    });

    /** An id with a slash or a space in it must not be able to reshape the path. */
    it("percent-encodes the address id into the path", async () => {
        mockFetch.mockResolvedValueOnce(jsonResponse({ id: "a/1" }, 200));

        await updateAddress("tok-1", "a/1", {
            label: null, block: null, road: null, building: null, flat: null, note: null,
        });

        const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toBe(`${BASE_URL}/customer/addresses/a%2F1`);
    });
});

/**
 * §1.7 — the settle-then-create call. It has no test of its own anywhere else; the checkout
 * screens only ever see it mocked, so the request shape it actually puts on the wire is pinned
 * here or nowhere.
 */
describe("payForDelivery", () => {
    const ORDER = { tel: "97312345678", type: "Delivery", idempotency_key: "idem-1" };

    it("posts the method, the address and the whole order in one body", async () => {
        mockFetch.mockResolvedValueOnce(jsonResponse(
            { orderNo: 41, status: "Pending Payment", redirectUrl: "https://pay.example/x", stub: false }, 201));

        await payForDelivery({ method: "BENEFIT", addressId: "a1", order: ORDER });

        const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toBe(`${BASE_URL}/delivery/payment/checkout`);
        expect(init.method).toBe("POST");
        const body = JSON.parse(init.body as string);
        expect(body.method).toBe("BENEFIT");
        expect(body.addressId).toBe("a1");
        expect(body.order).toMatchObject(ORDER);
    });

    /**
     * The 201 carries `redirectUrl` and `status: "Pending Payment"` — the order EXISTS but is NOT
     * paid. An earlier version of the type claimed `{ orderId, status: 'PAID' | 'FAILED' }`, which
     * described neither the field names nor the values the backend sends, and TypeScript could not
     * catch it because the response is never validated. Pinning the real shape is the only guard.
     */
    it("returns the pending-payment result with the redirect the customer must be sent to", async () => {
        mockFetch.mockResolvedValueOnce(jsonResponse(
            { orderNo: 41, status: "Pending Payment", redirectUrl: "https://pay.example/x", stub: false }, 201));

        const result = await payForDelivery({ method: "CARD", addressId: "a1", order: ORDER });

        expect(result).toMatchObject({
            orderNo: 41, status: "Pending Payment", redirectUrl: "https://pay.example/x", stub: false,
        });
    });

    /** Disabled in production, and the endpoint answers 501 — that must surface, not resolve. */
    it("throws when the payment stub is switched off", async () => {
        mockFetch.mockResolvedValueOnce(jsonResponse({ message: "Delivery payment stub is disabled" }, 501));

        await expect(payForDelivery({ method: "CARD", addressId: "a1", order: ORDER }))
            .rejects.toMatchObject({ name: "DeliveryApiError", status: 501,
                message: "Delivery payment stub is disabled" });
    });
});

describe("reportKeetaFallbackChosen", () => {
    let warnSpy: ReturnType<typeof jest.spyOn>;

    beforeEach(() => {
        warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    });

    afterEach(() => {
        warnSpy.mockRestore();
    });

    it("POSTs the stage and reason to the public event endpoint, with keepalive", async () => {
        mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

        await reportKeetaFallbackChosen({ stage: "ADDRESS", reason: "OUTSIDE_RADIUS" });

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toBe(`${BASE_URL}/delivery/keeta-fallback-events`);
        expect(init.method).toBe("POST");
        // The customer may leave for Keeta in this very tab; the request must outlive the page.
        expect(init.keepalive).toBe(true);
        expect(JSON.parse(init.body as string)).toEqual({ stage: "ADDRESS", reason: "OUTSIDE_RADIUS" });
    });

    /** The event carries no identifier: no token, no phone, no address — only the anonymous session. */
    it("sends the platform and demand session and no Authorization header", async () => {
        mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

        await reportKeetaFallbackChosen({ stage: "CART", reason: null });

        const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
        const headers = new Headers(init.headers);
        expect(headers.get("Content-Type")).toBe("application/json");
        expect(headers.get(CLIENT_PLATFORM_HEADER)).toBe("web");
        expect(headers.get(DEMAND_SESSION_HEADER)).toBe(getDemandSessionId());
        expect(headers.has("Authorization")).toBe(false);
        expect(JSON.parse(init.body as string)).toEqual({ stage: "CART", reason: null });
    });

    /**
     * Fire-and-forget: the customer is already on their way to Keeta, and our bookkeeping failing
     * must neither reject (an unhandled rejection) nor surface anywhere they can see it.
     */
    it("swallows a network failure and logs it as a warning", async () => {
        mockFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));

        await expect(reportKeetaFallbackChosen({ stage: "CART", reason: "NO_COURIER" })).resolves.toBeUndefined();

        expect(warnSpy).toHaveBeenCalledWith("Keeta fallback event could not be sent:", expect.any(TypeError));
    });

    it("treats a non-2xx answer as a warning, never an error", async () => {
        mockFetch.mockResolvedValueOnce(jsonResponse({ message: "bad stage" }, 400));

        await expect(reportKeetaFallbackChosen({ stage: "CART", reason: null })).resolves.toBeUndefined();

        expect(warnSpy).toHaveBeenCalledWith("Keeta fallback event was not recorded (HTTP 400)");
    });
});
