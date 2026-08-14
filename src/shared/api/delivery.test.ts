import { jest, describe, it, expect, beforeEach, afterEach, beforeAll } from "@jest/globals";
import { BASE_URL } from "./client";
import { getDeliveryAvailability, listAddresses, createAddress } from "./delivery";
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

        await expect(getDeliveryAvailability({ latitude: 91, longitude: 50 }))
            .rejects.toThrow(DeliveryApiError);
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
});
