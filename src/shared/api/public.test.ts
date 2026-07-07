import { jest, describe, it, expect, beforeEach, afterEach, beforeAll } from "@jest/globals";

// Uses the manual mock at __mocks__/client.ts.
// A factoryless jest.mock() has no babel-jest hoisting restrictions.
jest.mock("./client");

import { authFetch } from "./client";
import {
    createOrder,
    deleteOrder,
    updateAvailability,
    fetchBaseAppInfo,
    getAllActiveOrders,
    getHistory,
    updateOrderStatus,
} from "./public";
import { ItemsUnavailableError, BranchClosedError } from "../../domains/order/types";
import type { CreateOrderRequest, AvailabilityChange } from "../../domains/order/types";

const mockAuthFetch = jest.mocked(authFetch);

beforeAll(() => {
    Object.defineProperty(window, "location", {
        writable: true,
        configurable: true,
        value: { href: "" },
    });
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    jest.spyOn(console, "log").mockImplementation(() => undefined);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
});

beforeEach(() => {
    mockAuthFetch.mockReset();
});

afterEach(() => {
    jest.clearAllMocks();
});

// ── createOrder ───────────────────────────────────────────────────────────────

describe("createOrder", () => {
    const order: CreateOrderRequest = {
        tel: null,
        customer_name: null,
        type: "Dine In",
        payment_type: "CASH",
        branchId: "branch-1",
        notes: "",
        items: [],
        amount_paid: 0,
    };

    it("throws ItemsUnavailableError when the server responds with 409", async () => {
        const body = JSON.stringify({ message: "items unavailable", unavailableIds: [1, 2] });
        mockAuthFetch.mockResolvedValueOnce(
            new Response(body, { status: 409, headers: { "Content-Type": "application/json" } })
        );

        await expect(createOrder(order)).rejects.toThrow(ItemsUnavailableError);
    });

    it("includes unavailable item IDs in the ItemsUnavailableError", async () => {
        const body = JSON.stringify({ message: "unavailable", unavailableIds: [3, 5] });
        mockAuthFetch.mockResolvedValueOnce(
            new Response(body, { status: 409, headers: { "Content-Type": "application/json" } })
        );

        let caught: unknown;
        try {
            await createOrder(order);
        } catch (err) {
            caught = err;
        }

        expect(caught).toBeInstanceOf(ItemsUnavailableError);
        expect((caught as ItemsUnavailableError).unavailableIds).toEqual([3, 5]);
    });

    it("throws BranchClosedError when the server responds with 423", async () => {
        const body = JSON.stringify({ message: "We're sorry, this branch is closed right now." });
        mockAuthFetch.mockResolvedValueOnce(
            new Response(body, { status: 423, headers: { "Content-Type": "application/json" } })
        );

        let caught: unknown;
        try {
            await createOrder(order);
        } catch (err) {
            caught = err;
        }

        expect(caught).toBeInstanceOf(BranchClosedError);
        expect((caught as BranchClosedError).message).toBe("We're sorry, this branch is closed right now.");
    });

    it("throws a generic Error on non-ok status other than 409", async () => {
        mockAuthFetch.mockResolvedValueOnce(
            new Response(JSON.stringify({ message: "Server error" }), {
                status: 500,
                headers: { "Content-Type": "application/json" },
            })
        );

        await expect(createOrder(order)).rejects.toThrow(Error);
    });

    it("calls authFetch with POST method", async () => {
        mockAuthFetch.mockResolvedValueOnce(
            new Response(JSON.stringify({ id: 1 }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            })
        );

        await createOrder(order);

        const [, init] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        expect(init.method).toBe("POST");
    });

    it("calls the create_order endpoint", async () => {
        mockAuthFetch.mockResolvedValueOnce(
            new Response(JSON.stringify({ id: 1 }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            })
        );

        await createOrder(order);

        const [url] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toContain("create_order");
    });

    it("serialises the order as JSON in the request body", async () => {
        mockAuthFetch.mockResolvedValueOnce(
            new Response(JSON.stringify({ id: 1 }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            })
        );

        await createOrder(order);

        const [, init] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        const parsed = JSON.parse(init.body as string) as CreateOrderRequest;
        expect(parsed.type).toBe("Dine In");
    });
});

// ── deleteOrder ───────────────────────────────────────────────────────────────

describe("deleteOrder", () => {
    it("calls authFetch with DELETE method", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

        await deleteOrder("order-123");

        const [, init] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        expect(init.method).toBe("DELETE");
    });

    it("encodes the orderId in the query string", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

        await deleteOrder("order/with/slash");

        const [url] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toContain(encodeURIComponent("order/with/slash"));
    });

    it("throws when the server responds with a non-ok status", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 404 }));

        await expect(deleteOrder("missing-order")).rejects.toThrow();
    });
});

// ── updateAvailability ────────────────────────────────────────────────────────

describe("updateAvailability", () => {
    const changes: AvailabilityChange[] = [{ id: 1, available: false }];

    it("calls authFetch with PUT method", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response("ok", { status: 200 }));

        await updateAvailability(changes, "branch-1");

        const [, init] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        expect(init.method).toBe("PUT");
    });

    it("includes branchId in the request body", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response("ok", { status: 200 }));

        await updateAvailability(changes, "branch-42");

        const [, init] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        const parsed = JSON.parse(init.body as string) as { branchId: string };
        expect(parsed.branchId).toBe("branch-42");
    });

    it("includes doughInventory when provided", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response("ok", { status: 200 }));

        await updateAvailability(changes, "branch-1", { S: 5, M: 3, L: 2, Brick: 1 });

        const [, init] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        const parsed = JSON.parse(init.body as string) as { doughInventory: unknown };
        expect(parsed.doughInventory).toEqual({ S: 5, M: 3, L: 2, Brick: 1 });
    });

    it("sends doughInventory as null when omitted", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response("ok", { status: 200 }));

        await updateAvailability(changes, "branch-1");

        const [, init] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        const parsed = JSON.parse(init.body as string) as { doughInventory: unknown };
        expect(parsed.doughInventory).toBeNull();
    });

    it("throws when the server responds with a non-ok status", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 500 }));

        await expect(updateAvailability(changes, "branch-1")).rejects.toThrow();
    });
});

// ── fetchBaseAppInfo ──────────────────────────────────────────────────────────

describe("fetchBaseAppInfo", () => {
    // fetchBaseAppInfo uses raw fetch (not authFetch) because it is a public endpoint.
    let mockFetch = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
    let savedFetch: typeof globalThis.fetch;

    beforeEach(() => {
        savedFetch = global.fetch;
        mockFetch = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
        // Cast: jest.Mock carries extra mock methods beyond the fetch call signature;
        // structurally compatible at the call site.
        global.fetch = mockFetch as typeof fetch;
    });

    afterEach(() => {
        global.fetch = savedFetch;
    });

    it("throws when the server responds with a non-ok status", async () => {
        mockFetch.mockResolvedValueOnce(new Response(null, { status: 503 }));

        await expect(fetchBaseAppInfo(null, "branch-1")).rejects.toThrow();
    });

    it("calls GET on the get_base_app_info endpoint", async () => {
        mockFetch.mockResolvedValueOnce(
            new Response(JSON.stringify({ menu: [], workingHours: null }), { status: 200 })
        );

        await fetchBaseAppInfo(null, "branch-xyz");

        const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toContain("get_base_app_info");
    });

    it("appends userId to the query string when provided", async () => {
        mockFetch.mockResolvedValueOnce(
            new Response(JSON.stringify({ menu: [], workingHours: null }), { status: 200 })
        );

        await fetchBaseAppInfo("user-42", "branch-xyz");

        const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toContain("userId=user-42");
    });

    it("does not include userId in the query string when not provided", async () => {
        mockFetch.mockResolvedValueOnce(
            new Response(JSON.stringify({ menu: [], workingHours: null }), { status: 200 })
        );

        await fetchBaseAppInfo(null, "branch-xyz");

        const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
        expect(url).not.toContain("userId=");
    });

    it("includes the provided branchId in the query string", async () => {
        mockFetch.mockResolvedValueOnce(
            new Response(JSON.stringify({ menu: [], workingHours: null }), { status: 200 })
        );

        await fetchBaseAppInfo(null, "branch-xyz");

        const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toContain("branchId=branch-xyz");
    });

    it("falls back to the default branch when branchId is empty", async () => {
        mockFetch.mockResolvedValueOnce(
            new Response(JSON.stringify({ menu: [], workingHours: null }), { status: 200 })
        );

        await fetchBaseAppInfo(null, "");

        const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toContain("branchId=2e8c35f7-d75e-4442-b496-cbb929842c10");
    });
});

// ── getAllActiveOrders ────────────────────────────────────────────────────────

describe("getAllActiveOrders", () => {
    it("throws when the server responds with a non-ok status", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 500 }));

        await expect(getAllActiveOrders("branch-1")).rejects.toThrow();
    });

    it("includes branchId in the request URL", async () => {
        mockAuthFetch.mockResolvedValueOnce(
            new Response(JSON.stringify([]), { status: 200 })
        );

        await getAllActiveOrders("branch-abc");

        const [url] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toContain("branch-abc");
    });

    it("calls the get_all_active_orders endpoint", async () => {
        mockAuthFetch.mockResolvedValueOnce(
            new Response(JSON.stringify([]), { status: 200 })
        );

        await getAllActiveOrders("branch-1");

        const [url] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toContain("get_all_active_orders");
    });
});

// ── getHistory ────────────────────────────────────────────────────────────────

describe("getHistory", () => {
    it("throws when the server responds with a non-ok status", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 500 }));

        await expect(getHistory({ branchId: "branch-1", page: 0 })).rejects.toThrow();
    });

    it("includes branchId, page, and size in the request URL", async () => {
        mockAuthFetch.mockResolvedValueOnce(
            new Response(JSON.stringify({ orders: [], hasMore: false }), { status: 200 })
        );

        await getHistory({ branchId: "branch-xyz", page: 1, size: 20 });

        const [url] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toContain("get_history");
        expect(url).toContain("branchId=branch-xyz");
        expect(url).toContain("page=1");
        expect(url).toContain("size=20");
    });

    it("omits size from the URL when not provided", async () => {
        mockAuthFetch.mockResolvedValueOnce(
            new Response(JSON.stringify({ orders: [], hasMore: false }), { status: 200 })
        );

        await getHistory({ branchId: "branch-xyz", page: 0 });

        const [url] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        expect(url).not.toContain("size=");
    });

    it("includes the orderId query param when filtering by orderId", async () => {
        mockAuthFetch.mockResolvedValueOnce(
            new Response(JSON.stringify({ orders: [], hasMore: false }), { status: 200 })
        );

        await getHistory({ branchId: "branch-1", page: 0, filter: { type: "orderId", value: 12345678 } });

        const [url] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toContain("orderId=12345678");
        expect(url).not.toContain("externalId=");
        expect(url).not.toContain("customerName=");
    });

    it("includes the externalId query param when filtering by externalId", async () => {
        mockAuthFetch.mockResolvedValueOnce(
            new Response(JSON.stringify({ orders: [], hasMore: false }), { status: 200 })
        );

        await getHistory({ branchId: "branch-1", page: 0, filter: { type: "externalId", value: 1234567890123456 } });

        const [url] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toContain("externalId=1234567890123456");
        expect(url).not.toContain("orderId=");
        expect(url).not.toContain("customerName=");
    });

    it("includes the customerName query param when filtering by customerName", async () => {
        mockAuthFetch.mockResolvedValueOnce(
            new Response(JSON.stringify({ orders: [], hasMore: false }), { status: 200 })
        );

        await getHistory({ branchId: "branch-1", page: 0, filter: { type: "customerName", value: "John" } });

        const [url] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toContain("customerName=John");
        expect(url).not.toContain("orderId=");
        expect(url).not.toContain("externalId=");
    });

    it("omits the filter query param entirely when filter type is none", async () => {
        mockAuthFetch.mockResolvedValueOnce(
            new Response(JSON.stringify({ orders: [], hasMore: false }), { status: 200 })
        );

        await getHistory({ branchId: "branch-1", page: 0, filter: { type: "none" } });

        const [url] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        expect(url).not.toContain("orderId=");
        expect(url).not.toContain("externalId=");
        expect(url).not.toContain("customerName=");
    });

    it("returns the parsed orders and hasMore from the response body", async () => {
        mockAuthFetch.mockResolvedValueOnce(
            new Response(JSON.stringify({ orders: [], hasMore: true }), { status: 200 })
        );

        const result = await getHistory({ branchId: "branch-1", page: 0 });

        expect(result).toEqual({ orders: [], hasMore: true });
    });
});

// ── updateOrderStatus ─────────────────────────────────────────────────────────

describe("updateOrderStatus", () => {
    it("calls authFetch with POST method", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

        await updateOrderStatus({ orderId: "1", jahezOrderId: null, orderStatus: "Ready", reason: null });

        const [, init] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        expect(init.method).toBe("POST");
    });

    it("serialises orderStatus in the request body", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

        await updateOrderStatus({ orderId: "1", jahezOrderId: null, orderStatus: "Ready", reason: null });

        const [, init] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        const parsed = JSON.parse(init.body as string) as { orderStatus: string };
        expect(parsed.orderStatus).toBe("Ready");
    });

    it("resolves without throwing when the server responds with 200", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

        await expect(
            updateOrderStatus({ orderId: "1", jahezOrderId: null, orderStatus: "Ready", reason: null })
        ).resolves.not.toThrow();
    });
});
