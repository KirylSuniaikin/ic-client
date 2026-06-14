import { jest, describe, it, expect, beforeEach, afterEach, beforeAll } from "@jest/globals";

// Uses the manual mock at __mocks__/client.ts.
// A factoryless jest.mock() has no babel-jest hoisting restrictions.
jest.mock("./client");

import { authFetch } from "./client";
import {
    fetchCurrentPrepPlan,
    generatePrepPlan,
    fetchAllBranches,
    getReports,
    initiateAuth,
    fetchProducts,
    getVatStats,
    getDoughInventory,
    putDoughInventory,
    getBranchBalance,
} from "./management";

const mockAuthFetch = jest.mocked(authFetch);

beforeAll(() => {
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

// ── fetchCurrentPrepPlan ──────────────────────────────────────────────────────

describe("fetchCurrentPrepPlan", () => {
    it("returns null when the server responds with 204 No Content", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

        const result = await fetchCurrentPrepPlan(1);

        expect(result).toBeNull();
    });

    it("returns parsed JSON on a 200 response", async () => {
        const plan = { reportId: 7, createdAt: "2026-01-01T10:00:00", rows: [] };
        mockAuthFetch.mockResolvedValueOnce(
            new Response(JSON.stringify(plan), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            })
        );

        const result = await fetchCurrentPrepPlan(7);

        expect(result).toEqual(plan);
    });

    it("throws when the server responds with a non-ok status other than 204", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 404 }));

        await expect(fetchCurrentPrepPlan(99)).rejects.toThrow();
    });

    it("calls the prep-plan/current endpoint with the branchId", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

        await fetchCurrentPrepPlan(42);

        const [url] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toContain("prep-plan/current");
        expect(url).toContain("42");
    });
});

// ── generatePrepPlan ──────────────────────────────────────────────────────────

describe("generatePrepPlan", () => {
    it("calls authFetch with POST method", async () => {
        const response = { reportId: 1, createdAt: "2026-01-01T00:00:00", rows: [] };
        mockAuthFetch.mockResolvedValueOnce(
            new Response(JSON.stringify(response), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            })
        );

        await generatePrepPlan({ branchId: 1 });

        const [, init] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        expect(init.method).toBe("POST");
    });

    it("serialises branchId and optional dates in the request body", async () => {
        const response = { reportId: 1, createdAt: "2026-01-01T00:00:00", rows: [] };
        mockAuthFetch.mockResolvedValueOnce(
            new Response(JSON.stringify(response), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            })
        );

        await generatePrepPlan({ branchId: 5, fromDate: "2026-01-01", toDate: "2026-01-07" });

        const [, init] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        const parsed = JSON.parse(init.body as string) as { branchId: number; fromDate: string };
        expect(parsed.branchId).toBe(5);
        expect(parsed.fromDate).toBe("2026-01-01");
    });

    it("throws when the server responds with a non-ok status", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 400 }));

        await expect(generatePrepPlan({ branchId: 1 })).rejects.toThrow();
    });
});

// ── fetchAllBranches ──────────────────────────────────────────────────────────

describe("fetchAllBranches", () => {
    it("calls the fetch_branches endpoint", async () => {
        mockAuthFetch.mockResolvedValueOnce(
            new Response(JSON.stringify([]), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            })
        );

        await fetchAllBranches();

        const [url] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toContain("fetch_branches");
    });

    it("returns an array of branches on 200", async () => {
        const branches = [{ id: "b1", name: "Main" }];
        mockAuthFetch.mockResolvedValueOnce(
            new Response(JSON.stringify(branches), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            })
        );

        const result = await fetchAllBranches();

        expect(result).toEqual(branches);
    });

    it("throws on non-ok status", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 500 }));

        await expect(fetchAllBranches()).rejects.toThrow();
    });
});

// ── getReports ────────────────────────────────────────────────────────────────

describe("getReports", () => {
    it("includes branchId and reportType in the query string", async () => {
        mockAuthFetch.mockResolvedValueOnce(
            new Response(JSON.stringify([]), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            })
        );

        await getReports({ branchId: "b1", reportType: "INVENTORY" });

        const [url] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toContain("branchId=b1");
        expect(url).toContain("reportType=INVENTORY");
    });

    it("includes optional from and to dates when provided", async () => {
        mockAuthFetch.mockResolvedValueOnce(
            new Response(JSON.stringify([]), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            })
        );

        await getReports({
            branchId: "b1",
            reportType: "SHIFT_REPORT",
            from: "2026-01-01",
            to: "2026-01-31",
        });

        const [url] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toContain("from=2026-01-01");
        expect(url).toContain("to=2026-01-31");
    });

    it("throws on non-ok status", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 500 }));

        await expect(getReports({ branchId: "b1", reportType: "INVENTORY" })).rejects.toThrow();
    });
});

// ── initiateAuth ──────────────────────────────────────────────────────────────

describe("initiateAuth", () => {
    // initiateAuth uses raw fetch (not authFetch) because no JWT exists at login time.
    let mockFetch = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
    let savedFetch: typeof globalThis.fetch;

    beforeEach(() => {
        savedFetch = global.fetch;
        mockFetch = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
        // Cast: jest.Mock is a structurally-compatible superset of typeof fetch.
        global.fetch = mockFetch as typeof fetch;
    });

    afterEach(() => {
        global.fetch = savedFetch;
    });

    it("uses raw fetch instead of authFetch", async () => {
        mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

        await initiateAuth({ username: "admin", password: "secret" });

        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockAuthFetch).not.toHaveBeenCalled();
    });

    it("calls the auth/login endpoint with POST", async () => {
        mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

        await initiateAuth({ username: "admin", password: "secret" });

        const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toContain("auth/login");
        expect(init.method).toBe("POST");
    });

    it("serialises credentials in the request body", async () => {
        mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

        await initiateAuth({ username: "myuser", password: "mypass" });

        const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
        const parsed = JSON.parse(init.body as string) as { username: string; password: string };
        expect(parsed.username).toBe("myuser");
        expect(parsed.password).toBe("mypass");
    });
});

// ── fetchProducts ─────────────────────────────────────────────────────────────

describe("fetchProducts", () => {
    it("calls the fetch_products endpoint", async () => {
        mockAuthFetch.mockResolvedValueOnce(
            new Response(JSON.stringify([]), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            })
        );

        await fetchProducts();

        const [url] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toContain("fetch_products");
    });

    it("throws on non-ok status", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 500 }));

        await expect(fetchProducts()).rejects.toThrow();
    });
});

// ── getVatStats ───────────────────────────────────────────────────────────────

describe("getVatStats", () => {
    it("includes branchId, fromDate, and toDate in the query string", async () => {
        mockAuthFetch.mockResolvedValueOnce(
            new Response(JSON.stringify({ totalOrders: 10, totalRevenue: 500, branchName: "Main" }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            })
        );

        await getVatStats({ branchId: "b1", fromDate: "2026-01-01", toDate: "2026-01-31" });

        const [url] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toContain("branchId=b1");
        expect(url).toContain("fromDate=2026-01-01");
        expect(url).toContain("toDate=2026-01-31");
    });

    it("throws on non-ok status", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 500 }));

        await expect(
            getVatStats({ branchId: "b1", fromDate: "2026-01-01", toDate: "2026-01-31" })
        ).rejects.toThrow();
    });
});

// ── getDoughInventory / putDoughInventory ─────────────────────────────────────

describe("getDoughInventory", () => {
    it("calls the dough-inventory endpoint with the branchId", async () => {
        mockAuthFetch.mockResolvedValueOnce(
            new Response(JSON.stringify({ inventory: {}, availability: {} }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            })
        );

        await getDoughInventory("branch-99");

        const [url] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toContain("branch-99");
        expect(url).toContain("dough-inventory");
    });

    it("throws on non-ok status", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 404 }));

        await expect(getDoughInventory("branch-99")).rejects.toThrow();
    });
});

describe("putDoughInventory", () => {
    it("calls PUT on the dough-inventory endpoint", async () => {
        mockAuthFetch.mockResolvedValueOnce(
            new Response(JSON.stringify({ inventory: {}, availability: {} }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            })
        );

        await putDoughInventory("branch-1", { S: 5, M: 3, L: 2, Brick: 1 });

        const [, init] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        expect(init.method).toBe("PUT");
    });

    it("serialises inventory amounts in the request body", async () => {
        mockAuthFetch.mockResolvedValueOnce(
            new Response(JSON.stringify({ inventory: {}, availability: {} }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            })
        );

        await putDoughInventory("branch-1", { S: 10, M: 8, L: 6, Brick: 4 });

        const [, init] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        const parsed = JSON.parse(init.body as string) as { S: number };
        expect(parsed.S).toBe(10);
    });
});

// ── getBranchBalance ──────────────────────────────────────────────────────────

describe("getBranchBalance", () => {
    it("calls the get_branch_balance endpoint with the branchId", async () => {
        mockAuthFetch.mockResolvedValueOnce(
            new Response(JSON.stringify({ balance: 0 }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            })
        );

        await getBranchBalance("branch-42");

        const [url] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toContain("get_branch_balance");
        expect(url).toContain("branch-42");
    });

    it("throws on non-ok status", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 500 }));

        await expect(getBranchBalance("branch-42")).rejects.toThrow();
    });
});
