import { jest, describe, it, expect, beforeEach, afterEach, beforeAll } from "@jest/globals";
import { BASE_URL } from "./client";
import { getDeliveryAvailability, listAddresses, createAddress, updateAddress, payForDelivery } from "./delivery";
import { DeliveryApiError } from "../../domains/delivery/types";

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
        expect(init.headers).toBeUndefined();
    });

    it("sends lat and lng together once a pin exists", async () => {
        mockFetch.mockResolvedValueOnce(jsonResponse({ available: true, reason: null, branchId: "b1",
            etaMinutesMin: 20, etaMinutesMax: 30 }));

        await getDeliveryAvailability({ latitude: 26.2285, longitude: 50.586 });

        const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toBe(`${BASE_URL}/delivery/availability?lat=26.2285&lng=50.586`);
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
