import { jest, describe, it, expect, beforeEach, afterEach, beforeAll } from "@jest/globals";
import { BASE_URL } from "./client";
import {
    requestOtp,
    verifyOtp,
    refreshCustomerToken,
    logoutCustomer,
    fetchCustomerMe,
    fetchMyOrders,
    fetchActiveOrder,
    fetchSuggestedItems,
    registerCustomerName,
} from "./customerAuth";
import { CustomerAuthApiError } from "../../domains/customer-auth/types";

beforeAll(() => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
});

// A module-level mock avoids spy-restoration side effects between tests (mirrors client.test.ts).
let mockFetch = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
let savedFetch: typeof globalThis.fetch;

beforeEach(() => {
    savedFetch = global.fetch;
    mockFetch = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
    // Cast: jest.Mock is a superset of the fetch signature; the extra mock
    // methods do not affect runtime compatibility as a fetch replacement.
    global.fetch = mockFetch as typeof fetch;
});

afterEach(() => {
    global.fetch = savedFetch;
});

describe("requestOtp", () => {
    it("posts to /auth/otp/request with credentials: 'include'", async () => {
        mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

        await requestOtp({ phone: "97333607710" });

        const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toBe(`${BASE_URL}/auth/otp/request`);
        expect(init.method).toBe("POST");
        expect(init.credentials).toBe("include");
        expect(init.body).toBe(JSON.stringify({ phone: "97333607710" }));
    });

    it("throws a CustomerAuthApiError on a non-2xx response", async () => {
        mockFetch.mockResolvedValueOnce(
            new Response(JSON.stringify({ message: "too soon" }), { status: 429 })
        );

        await expect(requestOtp({ phone: "97333607710" })).rejects.toThrow(CustomerAuthApiError);
    });

    it("surfaces the response status on the thrown error", async () => {
        mockFetch.mockResolvedValueOnce(new Response(null, { status: 429 }));

        await expect(requestOtp({ phone: "97333607710" })).rejects.toMatchObject({ status: 429 });
    });
});

describe("verifyOtp", () => {
    it("posts to /auth/otp/verify with credentials: 'include' and the payload", async () => {
        mockFetch.mockResolvedValueOnce(
            new Response(JSON.stringify({ accessToken: "token-abc" }), { status: 200 })
        );

        const payload = { phone: "97333607710", code: "4821", branchId: "branch-1" };
        const result = await verifyOtp(payload);

        const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toBe(`${BASE_URL}/auth/otp/verify`);
        expect(init.method).toBe("POST");
        expect(init.credentials).toBe("include");
        expect(init.body).toBe(JSON.stringify(payload));
        expect(result).toEqual({ accessToken: "token-abc" });
    });

    it("throws a CustomerAuthApiError with the extracted message on a 400", async () => {
        mockFetch.mockResolvedValueOnce(
            new Response(JSON.stringify({ message: "invalid code" }), { status: 400 })
        );

        await expect(verifyOtp({ phone: "97333607710", code: "0000" })).rejects.toThrow("invalid code");
    });
});

describe("refreshCustomerToken", () => {
    it("posts to /auth/refresh with credentials: 'include' and no body", async () => {
        mockFetch.mockResolvedValueOnce(
            new Response(JSON.stringify({ accessToken: "refreshed-token" }), { status: 200 })
        );

        const result = await refreshCustomerToken();

        const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toBe(`${BASE_URL}/auth/refresh`);
        expect(init.method).toBe("POST");
        expect(init.credentials).toBe("include");
        expect(result).toEqual({ accessToken: "refreshed-token" });
    });

    it("throws a CustomerAuthApiError on 401", async () => {
        mockFetch.mockResolvedValueOnce(new Response(null, { status: 401 }));

        await expect(refreshCustomerToken()).rejects.toThrow(CustomerAuthApiError);
    });
});

describe("logoutCustomer", () => {
    it("posts to /auth/logout with credentials: 'include'", async () => {
        mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

        await logoutCustomer();

        const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toBe(`${BASE_URL}/auth/logout`);
        expect(init.method).toBe("POST");
        expect(init.credentials).toBe("include");
    });

    it("throws a CustomerAuthApiError on a non-2xx response", async () => {
        mockFetch.mockResolvedValueOnce(new Response(null, { status: 500 }));

        await expect(logoutCustomer()).rejects.toThrow(CustomerAuthApiError);
    });
});

// task-spec.md §5.5a — mirrors fetchCustomerMe's pattern (Bearer token, credentials: include).
describe("registerCustomerName", () => {
    it("posts to /customer/name with credentials: 'include', the Bearer token, and the name body", async () => {
        mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

        await registerCustomerName("my-access-token", "Sara");

        const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toBe(`${BASE_URL}/customer/name`);
        expect(init.method).toBe("POST");
        expect(init.credentials).toBe("include");
        const headers = new Headers(init.headers);
        expect(headers.get("Authorization")).toBe("Bearer my-access-token");
        expect(init.body).toBe(JSON.stringify({ name: "Sara" }));
    });

    it("throws a CustomerAuthApiError on a 400", async () => {
        mockFetch.mockResolvedValueOnce(
            new Response(JSON.stringify({ message: "Name is required" }), { status: 400 })
        );

        await expect(registerCustomerName("my-access-token", "")).rejects.toThrow(CustomerAuthApiError);
    });
});

describe("fetchCustomerMe", () => {
    it("gets /customer/me with credentials: 'include' and the Bearer token", async () => {
        const profile = {
            id: "acct-1",
            phone: "97333607710",
            preferredBranchId: null,
            name: null,
            address: null,
            amountOfOrders: null,
            lastOrderDate: null,
        };
        mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(profile), { status: 200 }));

        const result = await fetchCustomerMe("my-access-token");

        const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toBe(`${BASE_URL}/customer/me`);
        expect(init.method).toBe("GET");
        expect(init.credentials).toBe("include");
        const headers = new Headers(init.headers);
        expect(headers.get("Authorization")).toBe("Bearer my-access-token");
        expect(result).toEqual(profile);
    });

    it("throws a CustomerAuthApiError on a 401", async () => {
        mockFetch.mockResolvedValueOnce(new Response(null, { status: 401 }));

        await expect(fetchCustomerMe("bad-token")).rejects.toThrow(CustomerAuthApiError);
    });
});

describe("fetchMyOrders", () => {
    it("gets /customer/orders with page/size query params, credentials: 'include', and the Bearer token", async () => {
        const page = {
            orders: [
                {
                    id: 1234,
                    orderNumber: 88,
                    status: "Picked Up",
                    orderType: "Pick Up",
                    amountPaid: 12.5,
                    createdAt: "2026-06-20 18:42",
                },
            ],
            page: 0,
            size: 3,
            totalElements: 7,
            totalPages: 3,
            hasNext: true,
        };
        mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(page), { status: 200 }));

        const result = await fetchMyOrders("my-access-token", 0, 3);

        const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toBe(`${BASE_URL}/customer/orders?page=0&size=3`);
        expect(init.method).toBe("GET");
        expect(init.credentials).toBe("include");
        const headers = new Headers(init.headers);
        expect(headers.get("Authorization")).toBe("Bearer my-access-token");
        expect(result).toEqual(page);
    });

    it("throws a CustomerAuthApiError on a 401", async () => {
        mockFetch.mockResolvedValueOnce(new Response(null, { status: 401 }));

        await expect(fetchMyOrders("bad-token", 0, 3)).rejects.toThrow(CustomerAuthApiError);
    });
});

describe("fetchActiveOrder", () => {
    it("gets /customer/orders/active with credentials: 'include' and the Bearer token", async () => {
        const activeOrder = {
            id: 1234,
            orderNumber: 88,
            status: "Kitchen Phase",
            createdAt: "2026-07-01 12:00",
            estimation: 15,
            branchId: "branch-1",
            branchName: "Downtown",
        };
        mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(activeOrder), { status: 200 }));

        const result = await fetchActiveOrder("my-access-token");

        const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toBe(`${BASE_URL}/customer/orders/active`);
        expect(init.method).toBe("GET");
        expect(init.credentials).toBe("include");
        const headers = new Headers(init.headers);
        expect(headers.get("Authorization")).toBe("Bearer my-access-token");
        expect(result).toEqual(activeOrder);
    });

    it("returns null on a 204 (no active order)", async () => {
        mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

        const result = await fetchActiveOrder("my-access-token");

        expect(result).toBeNull();
    });

    it("throws a CustomerAuthApiError on a 401", async () => {
        mockFetch.mockResolvedValueOnce(new Response(null, { status: 401 }));

        await expect(fetchActiveOrder("bad-token")).rejects.toThrow(CustomerAuthApiError);
    });
});

describe("fetchSuggestedItems", () => {
    it("gets /customer/orders/suggested with credentials: 'include' and the Bearer token", async () => {
        const suggested = {
            items: [
                {
                    menuItemId: 42,
                    name: "Pepperoni",
                    nameAr: null,
                    size: "M",
                    category: "Pizzas",
                    quantity: 1,
                    price: 3.5,
                    photo: null,
                    available: true,
                },
            ],
            fallback: false,
        };
        mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(suggested), { status: 200 }));

        const result = await fetchSuggestedItems("my-access-token");

        const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toBe(`${BASE_URL}/customer/orders/suggested`);
        expect(init.method).toBe("GET");
        expect(init.credentials).toBe("include");
        const headers = new Headers(init.headers);
        expect(headers.get("Authorization")).toBe("Bearer my-access-token");
        expect(result).toEqual(suggested);
    });

    it("throws a CustomerAuthApiError on a 401", async () => {
        mockFetch.mockResolvedValueOnce(new Response(null, { status: 401 }));

        await expect(fetchSuggestedItems("bad-token")).rejects.toThrow(CustomerAuthApiError);
    });
});
