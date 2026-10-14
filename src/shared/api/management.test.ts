import type { SalarySlipForm } from '../../domains/management/shift/types';
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
    getUser,
    getVatStats,
    getDoughInventory,
    putDoughInventory,
    getBranchBalance,
    getBranchEvents,
    getWorkingHours,
    putWorkingHours,
    updateStaffPayroll,
    downloadSalarySlip,
    getMonthlyShiftReport,
    getSalarySlipPreview,
    getCurrentStaff,
    fetchTelegramBotUsername,
    generateTelegramConnectToken,
    fetchDeliveryEstimateAccuracy,
    fetchDeliverySkipReasonStats,
    fetchDeliveryZoneStats,
    fetchTimeToCourierStats,
    fetchDeliveryQualityStats,
    fetchLostDemandStats,
    fetchLostDemandZoneStats,
    fetchCourierProductivity,
    createProduct,
    updateProductSettings,
    patchChannelOverride,
    updateCategoryClassification,
    updateComponentCost,
    createVendor,
} from "./management";
import { DuplicateProductNameError } from "../../domains/management/inventory/types";
import { DuplicateVendorNameError } from "../../domains/management/purchases/types";
import { ChannelRowConflictError } from "../../domains/management/statistics/types";
import type { ChannelOverridePatch, ChannelPerformanceMonth } from "../../domains/management/statistics/types";
import type {
    CreateProductRequest,
    ProductTO,
    UpdateProductSettingsRequest
} from "../../domains/management/inventory/types";
import type { WorkingHoursResponse, WorkingHoursRequest } from "./management";
import { CLIENT_PLATFORM_HEADER, CLIENT_PLATFORM_WEB } from "./clientPlatform";
import type { StaffAdminTO, UpdateStaffPayrollRequest } from "../../domains/management/staff/types";
import { StaffRoles } from "../../domains/auth/types";

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

        const result = await fetchCurrentPrepPlan("1");

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

        const result = await fetchCurrentPrepPlan("7");

        expect(result).toEqual(plan);
    });

    it("throws when the server responds with a non-ok status other than 204", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 404 }));

        await expect(fetchCurrentPrepPlan("99")).rejects.toThrow();
    });

    it("calls the prep-plan/current endpoint with the branchId", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

        await fetchCurrentPrepPlan("42");

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

        await generatePrepPlan({ branchId: "1" });

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

        await generatePrepPlan({ branchId: "5", fromDate: "2026-01-01", toDate: "2026-01-07" });

        const [, init] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        const parsed = JSON.parse(init.body as string) as { branchId: string; fromDate: string };
        expect(parsed.branchId).toBe("5");
        expect(parsed.fromDate).toBe("2026-01-01");
    });

    it("throws when the server responds with a non-ok status", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 400 }));

        await expect(generatePrepPlan({ branchId: "1" })).rejects.toThrow();
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

    it("opts into authFetch's retry on a transient network blip", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));

        await fetchAllBranches();

        const [, , options] = mockAuthFetch.mock.calls[0] as [string, RequestInit, { retryDelaysMs?: number[] } | undefined];
        expect(options?.retryDelaysMs).toBeDefined();
        expect(options?.retryDelaysMs?.length).toBeGreaterThan(0);
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

// ── getCurrentStaff ───────────────────────────────────────────────────────────

// task-spec.md Extra defect 1: this identity call opts out of authFetch's global 401
// sign-out redirect, so a stale/racy identity check on mount can never itself sign a
// staff member out -- only a real API call rejecting with 401 still does that.
describe("getCurrentStaff", () => {
    it("calls authFetch for GET /staff/me with the skipAuthRedirectOn401 opt-out", async () => {
        mockAuthFetch.mockResolvedValueOnce(
            new Response(
                JSON.stringify({ id: 7, username: "casey.cook", fullName: "Casey Cook", role: StaffRoles.MANAGER, branchId: "branch-1" }),
                { status: 200, headers: { "Content-Type": "application/json" } }
            )
        );

        await getCurrentStaff();

        const [url, init, options] = mockAuthFetch.mock.calls[0] as [string, RequestInit, { skipAuthRedirectOn401?: boolean }];
        expect(url).toContain("/staff/me");
        expect(init.method).toBe("GET");
        expect(options).toEqual({ skipAuthRedirectOn401: true });
    });

    it("throws on a non-ok status", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 500 }));

        await expect(getCurrentStaff()).rejects.toThrow();
    });
});

// ── fetchTelegramBotUsername ──────────────────────────────────────────────────

describe("fetchTelegramBotUsername", () => {
    it("calls authFetch for GET /staff/telegram-bot-username and returns the parsed body", async () => {
        mockAuthFetch.mockResolvedValueOnce(
            new Response(
                JSON.stringify({ botUsername: "icpizza_bot" }),
                { status: 200, headers: { "Content-Type": "application/json" } }
            )
        );

        const result = await fetchTelegramBotUsername();

        const [url, init] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toContain("/staff/telegram-bot-username");
        expect(init.method).toBe("GET");
        expect(result).toEqual({ botUsername: "icpizza_bot" });
    });

    it("throws on a non-ok status", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 500 }));

        await expect(fetchTelegramBotUsername()).rejects.toThrow();
    });
});

// ── generateTelegramConnectToken ─────────────────────────────────────────────

describe("generateTelegramConnectToken", () => {
    it("calls authFetch for POST /staff/{id}/telegram-connect-token and returns the parsed body", async () => {
        mockAuthFetch.mockResolvedValueOnce(
            new Response(
                JSON.stringify({ token: "server-issued-token" }),
                { status: 200, headers: { "Content-Type": "application/json" } }
            )
        );

        const result = await generateTelegramConnectToken(2);

        const [url, init] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toContain("/staff/2/telegram-connect-token");
        expect(init.method).toBe("POST");
        expect(result).toEqual({ token: "server-issued-token" });
    });

    it("throws on a non-ok status", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 500 }));

        await expect(generateTelegramConnectToken(2)).rejects.toThrow();
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

    it("sends X-Client-Platform: web", async () => {
        mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

        await initiateAuth({ username: "admin", password: "secret" });

        const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
        const headers = new Headers(init.headers);
        expect(headers.get(CLIENT_PLATFORM_HEADER)).toBe(CLIENT_PLATFORM_WEB);
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

    it("opts into authFetch's retry on a transient network blip", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));

        await fetchProducts();

        const [, , options] = mockAuthFetch.mock.calls[0] as [string, RequestInit, { retryDelaysMs?: number[] } | undefined];
        expect(options?.retryDelaysMs).toBeDefined();
        expect(options?.retryDelaysMs?.length).toBeGreaterThan(0);
    });
});

// ── createProduct / updateProductSettings ─────────────────────────────────────

function productResponse(overrides: Partial<ProductTO> = {}): ProductTO {
    return {
        id: 42,
        name: "Basil",
        targetPrice: 1.5,
        price: null,
        isInventory: false,
        isPurchasable: true,
        isBundle: false,
        topVendor: "Acme",
        unit: "GRAMS",
        ...overrides,
    };
}

function jsonResponse(body: unknown, status: number): Response {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("createProduct", () => {
    const request: CreateProductRequest = {
        name: "Basil",
        targetPrice: 1.5,
        unit: "GRAMS",
        topVendor: "Acme",
        isInventory: false,
        isPurchasable: true,
    };

    it("POSTs the JSON body to the products endpoint", async () => {
        mockAuthFetch.mockResolvedValueOnce(jsonResponse(productResponse(), 200));

        await createProduct(request);

        const [url, init] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toBe("http://test-api.com/api/products");
        expect(init.method).toBe("POST");
        expect(JSON.parse(init.body as string)).toEqual(request);
    });

    it("returns the created product on any 2xx, 201 included", async () => {
        const created = productResponse();
        mockAuthFetch.mockResolvedValueOnce(jsonResponse(created, 201));

        const result = await createProduct(request);

        expect(result).toEqual(created);
    });

    it("throws a DuplicateProductNameError carrying the fixed message on 409", async () => {
        mockAuthFetch.mockResolvedValueOnce(jsonResponse({ message: "whatever the server said" }, 409));

        const failure = createProduct(request);

        await expect(failure).rejects.toBeInstanceOf(DuplicateProductNameError);
        await expect(failure).rejects.toThrow("A product with this name already exists");
    });

    it("surfaces the server's message on a 400", async () => {
        mockAuthFetch.mockResolvedValueOnce(jsonResponse({ status: 400, message: "Unknown vendor: Nobody" }, 400));

        await expect(createProduct(request)).rejects.toThrow("Unknown vendor: Nobody");
    });

    it("falls back to the status code when the error body is not JSON", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 403 }));

        await expect(createProduct(request)).rejects.toThrow("HTTP 403");
    });
});

describe("updateProductSettings", () => {
    const request: UpdateProductSettingsRequest = {
        isInventory: true,
        isPurchasable: false,
        unit: null,
        topVendor: null,
    };

    it("PATCHes the full four-field body to products/{id}/settings", async () => {
        mockAuthFetch.mockResolvedValueOnce(jsonResponse(productResponse({ id: 7 }), 200));

        await updateProductSettings(7, request);

        const [url, init] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toBe("http://test-api.com/api/products/7/settings");
        expect(init.method).toBe("PATCH");
        expect(JSON.parse(init.body as string)).toEqual(request);
    });

    it("returns the updated product on 200", async () => {
        const updated = productResponse({ id: 7, isInventory: true });
        mockAuthFetch.mockResolvedValueOnce(jsonResponse(updated, 200));

        const result = await updateProductSettings(7, request);

        expect(result).toEqual(updated);
    });

    it("throws with the status code on 404", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 404 }));

        await expect(updateProductSettings(999, request)).rejects.toThrow("HTTP 404");
    });
});

// ── createVendor ──────────────────────────────────────────────────────────────

describe("createVendor", () => {
    it("POSTs the name as {vendorName} to the vendors endpoint", async () => {
        mockAuthFetch.mockResolvedValueOnce(jsonResponse({ id: 9, vendorName: "Fresh Farms" }, 200));

        await createVendor("Fresh Farms");

        const [url, init] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toBe("http://test-api.com/api/vendors");
        expect(init.method).toBe("POST");
        expect(JSON.parse(init.body as string)).toEqual({ vendorName: "Fresh Farms" });
    });

    it("returns the created vendor on 200", async () => {
        const created = { id: 9, vendorName: "Fresh Farms" };
        mockAuthFetch.mockResolvedValueOnce(jsonResponse(created, 200));

        const result = await createVendor("Fresh Farms");

        expect(result).toEqual(created);
    });

    it("throws a DuplicateVendorNameError carrying the fixed message on 409", async () => {
        mockAuthFetch.mockResolvedValueOnce(jsonResponse({ message: "whatever the server said" }, 409));

        const failure = createVendor("Acme");

        await expect(failure).rejects.toBeInstanceOf(DuplicateVendorNameError);
        await expect(failure).rejects.toThrow("A vendor with this name already exists");
    });

    it("surfaces the server's message on a 400", async () => {
        mockAuthFetch.mockResolvedValueOnce(jsonResponse({ status: 400, message: "Vendor name is required" }, 400));

        await expect(createVendor(" ")).rejects.toThrow("Vendor name is required");
    });

    it("falls back to the status code when the error body is not JSON", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 403 }));

        await expect(createVendor("Fresh Farms")).rejects.toThrow("HTTP 403");
    });
});

// ── getUser ───────────────────────────────────────────────────────────────────

describe("getUser", () => {
    it("calls the get_user endpoint with the userId", async () => {
        mockAuthFetch.mockResolvedValueOnce(
            new Response(JSON.stringify({ id: 1, name: "Test" }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            })
        );

        await getUser(1);

        const [url] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toContain("get_user?userId=1");
    });

    it("returns the parsed user on 200", async () => {
        const user = { id: 1, name: "Test" };
        mockAuthFetch.mockResolvedValueOnce(
            new Response(JSON.stringify(user), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            })
        );

        const result = await getUser(1);

        expect(result).toEqual(user);
    });

    it("throws on non-ok status", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 500 }));

        await expect(getUser(1)).rejects.toThrow();
    });

    it("opts into authFetch's retry on a transient network blip", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(JSON.stringify({ id: 1 }), { status: 200 }));

        await getUser(1);

        const [, , options] = mockAuthFetch.mock.calls[0] as [string, RequestInit, { retryDelaysMs?: number[] } | undefined];
        expect(options?.retryDelaysMs).toBeDefined();
        expect(options?.retryDelaysMs?.length).toBeGreaterThan(0);
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

// ── getBranchEvents ───────────────────────────────────────────────────────────

describe("getBranchEvents", () => {
    function pageResponse(): Response {
        return new Response(JSON.stringify({ events: [], hasMore: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    }

    it("calls the get_transactions endpoint with the branchId, page and size", async () => {
        mockAuthFetch.mockResolvedValueOnce(pageResponse());

        await getBranchEvents({ branchId: "branch-42", page: 1, size: 30 });

        const [url] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toContain("get_transactions");
        expect(url).toContain("branchId=branch-42");
        expect(url).toContain("page=1");
        expect(url).toContain("size=30");
    });

    it("omits the size param when it is not provided", async () => {
        mockAuthFetch.mockResolvedValueOnce(pageResponse());

        await getBranchEvents({ branchId: "branch-42", page: 0 });

        const [url] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toContain("page=0");
        expect(url).not.toContain("size=");
    });

    it("returns the parsed events page", async () => {
        const page = { events: [{ id: "e1" }], hasMore: false };
        mockAuthFetch.mockResolvedValueOnce(
            new Response(JSON.stringify(page), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            })
        );

        const result = await getBranchEvents({ branchId: "branch-42", page: 0 });

        expect(result).toEqual(page);
    });

    it("throws on non-ok status", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 500 }));

        await expect(getBranchEvents({ branchId: "branch-42", page: 0 })).rejects.toThrow();
    });
});

// ── getWorkingHours ───────────────────────────────────────────────────────────

describe("getWorkingHours", () => {
    it("returns null when server responds with 204", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

        const result = await getWorkingHours("branch-1");

        expect(result).toBeNull();
    });

    it("returns WorkingHoursResponse when server responds with 200", async () => {
        const response: WorkingHoursResponse = {
            branchId: "branch-1",
            schedule: {
                Sunday: { isOpen: false, shifts: [] },
                Monday: { isOpen: true, shifts: [["15:00", "24:00"]] },
                Tuesday: { isOpen: false, shifts: [] },
                Wednesday: { isOpen: false, shifts: [] },
                Thursday: { isOpen: false, shifts: [] },
                Friday: { isOpen: false, shifts: [] },
                Saturday: { isOpen: false, shifts: [] },
            },
            updatedAt: "2026-06-30T10:00:00Z",
        };
        mockAuthFetch.mockResolvedValueOnce(
            new Response(JSON.stringify(response), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            })
        );

        const result = await getWorkingHours("branch-1");

        expect(result).toEqual(response);
    });

    it("throws when server responds with error status", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 403 }));

        await expect(getWorkingHours("branch-1")).rejects.toThrow("HTTP 403");
    });

    it("calls the branch/working_hours endpoint with branchId in the query string", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

        await getWorkingHours("branch-abc");

        const [url] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toContain("branch/working_hours");
        expect(url).toContain("branchId=branch-abc");
    });
});

// ── putWorkingHours ───────────────────────────────────────────────────────────

describe("putWorkingHours", () => {
    const payload: WorkingHoursRequest = {
        branchId: "branch-1",
        schedule: {
            Sunday: { isOpen: false, shifts: [] },
            Monday: { isOpen: true, shifts: [["15:00", "24:00"]] },
            Tuesday: { isOpen: true, shifts: [["15:00", "24:00"]] },
            Wednesday: { isOpen: true, shifts: [["15:00", "24:00"]] },
            Thursday: { isOpen: true, shifts: [["16:30", "01:30"]] },
            Friday: { isOpen: true, shifts: [["16:30", "01:30"]] },
            Saturday: { isOpen: true, shifts: [["14:00", "24:00"]] },
        },
    };

    it("calls authFetch with PUT method and JSON body", async () => {
        const response: WorkingHoursResponse = {
            branchId: "branch-1",
            schedule: payload.schedule,
            updatedAt: "2026-06-30T10:00:00Z",
        };
        mockAuthFetch.mockResolvedValueOnce(
            new Response(JSON.stringify(response), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            })
        );

        await putWorkingHours(payload);

        const [, init] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        expect(init.method).toBe("PUT");
        const parsed = JSON.parse(init.body as string) as WorkingHoursRequest;
        expect(parsed.branchId).toBe("branch-1");
    });

    it("returns WorkingHoursResponse when server responds with 200", async () => {
        const response: WorkingHoursResponse = {
            branchId: "branch-1",
            schedule: payload.schedule,
            updatedAt: "2026-06-30T10:00:00Z",
        };
        mockAuthFetch.mockResolvedValueOnce(
            new Response(JSON.stringify(response), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            })
        );

        const result = await putWorkingHours(payload);

        expect(result).toEqual(response);
    });

    it("throws when server responds with error status", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 403 }));

        await expect(putWorkingHours(payload)).rejects.toThrow("HTTP 403");
    });
});

// ── updateStaffPayroll ────────────────────────────────────────────────────────

describe("updateStaffPayroll", () => {
    const payload: UpdateStaffPayrollRequest = {
        cprNumber: "990101123",
        basicSalary: 240,
        housingAllowance: 60,
        transportAllowance: 40,
    };

    function staffResponse(): StaffAdminTO {
        return {
            id: 5,
            username: "casey.cook",
            fullName: "Casey Cook",
            role: StaffRoles.COOK,
            branchId: "branch-1",
            pricePerHour: 3,
            enabled: true,
            cprNumber: "990101123",
            basicSalary: 240,
            housingAllowance: 60,
            transportAllowance: 40,
            telegramConnected: false,
        };
    }

    it("calls the staff/{id}/payroll endpoint with PATCH and the JSON body", async () => {
        mockAuthFetch.mockResolvedValueOnce(
            new Response(JSON.stringify(staffResponse()), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            })
        );

        await updateStaffPayroll(5, payload);

        const [url, init] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toContain("staff/5/payroll");
        expect(init.method).toBe("PATCH");
        expect(JSON.parse(init.body as string)).toEqual(payload);
    });

    it("returns the updated StaffAdminTO on 200", async () => {
        const response = staffResponse();
        mockAuthFetch.mockResolvedValueOnce(
            new Response(JSON.stringify(response), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            })
        );

        const result = await updateStaffPayroll(5, payload);

        expect(result).toEqual(response);
    });

    it("throws on non-ok status", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 403 }));

        await expect(updateStaffPayroll(5, payload)).rejects.toThrow("HTTP 403");
    });
});

// ── getMonthlyShiftReport ─────────────────────────────────────────────────────

// Without from/to the backend sums its own default window (the calendar month) and reports it
// back; a lone from or to is a 400, so the pair travels together or not at all.
describe("getMonthlyShiftReport", () => {
    function reportResponse(): Response {
        return new Response(JSON.stringify({
            yearMonth: "2026-09", branchNo: 1, periodStart: "2026-09-01", periodEnd: "2026-09-30", summaries: [],
        }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    }

    it("sends only branchId and yearMonth when no range is given", async () => {
        mockAuthFetch.mockResolvedValueOnce(reportResponse());

        await getMonthlyShiftReport("b1", "2026-09");

        const [url] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toContain("shift_monthly_report");
        expect(url).toContain("branchId=b1");
        expect(url).toContain("yearMonth=2026-09");
        expect(url).not.toContain("from=");
        expect(url).not.toContain("to=");
    });

    it("sends from and to when a range is given", async () => {
        mockAuthFetch.mockResolvedValueOnce(reportResponse());

        await getMonthlyShiftReport("b1", "2026-09", { from: "2026-08-25", to: "2026-09-24" });

        const [url] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toContain("yearMonth=2026-09");
        expect(url).toContain("from=2026-08-25");
        expect(url).toContain("to=2026-09-24");
    });

    it("throws on non-ok status", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 400 }));

        await expect(getMonthlyShiftReport("b1", "2026-09")).rejects.toThrow("Response: 400");
    });
});

// ── getSalarySlipPreview ──────────────────────────────────────────────────────

// Without from/to the backend previews the pay cycle; the popup sends a range only once the owner
// re-picks the slip's dates.
describe("getSalarySlipPreview", () => {
    function previewResponse(): Response {
        return new Response(JSON.stringify(slipForm()), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    }

    it("sends only yearMonth when no range is given", async () => {
        mockAuthFetch.mockResolvedValueOnce(previewResponse());

        await getSalarySlipPreview(5, "2026-07");

        const [url] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toContain("staff/5/salary_slip/preview");
        expect(url).toContain("yearMonth=2026-07");
        expect(url).not.toContain("from=");
        expect(url).not.toContain("to=");
    });

    it("sends from and to when a range is given", async () => {
        mockAuthFetch.mockResolvedValueOnce(previewResponse());

        await getSalarySlipPreview(5, "2026-07", { from: "2026-07-01", to: "2026-07-31" });

        const [url] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toContain("yearMonth=2026-07");
        expect(url).toContain("from=2026-07-01");
        expect(url).toContain("to=2026-07-31");
    });

    it("returns the parsed form, window included", async () => {
        mockAuthFetch.mockResolvedValueOnce(previewResponse());

        const result = await getSalarySlipPreview(5, "2026-07");

        expect(result.periodStart).toBe("2026-06-25");
        expect(result.periodEnd).toBe("2026-07-24");
    });

    it("throws on non-ok status", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 400 }));

        await expect(getSalarySlipPreview(5, "2026-07")).rejects.toThrow("HTTP 400");
    });
});

// ── downloadSalarySlip ────────────────────────────────────────────────────────

// The confirmed slip body. downloadSalarySlip is a POST now: the popup sends back what the owner
// checked, so every call carries a form.
function slipForm(): SalarySlipForm {
    return {
        employeeName: "Casey Cook",
        position: "Cook",
        cprNumber: "850012345",
        payPeriodLabel: "July 2026",
        paymentDate: "2026-07-31",
        periodStart: "2026-06-25",
        periodEnd: "2026-07-24",
        basicSalary: 240,
        housingAllowance: 40,
        transportAllowance: null,
        overtimeHours: 4,
        overtimeRate: 1.5,
        overtimeAmount: 6,
        deductions: [],
        grossEarnings: 286,
        totalDeductions: 0,
        netPay: 286,
        amountInWords: "Bahraini Dinars Two Hundred Eighty Six Only",
        notes: ["1. Basic Salary of BD 240.000 paid in full with no deduction."],
    };
}

describe("downloadSalarySlip", () => {
    it("calls the staff/{id}/salary_slip endpoint with the yearMonth query param", async () => {
        mockAuthFetch.mockResolvedValueOnce(
            new Response(new Blob(["%PDF-"], { type: "application/pdf" }), { status: 200 })
        );

        await downloadSalarySlip(5, "2026-07", slipForm());

        const [url] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toContain("staff/5/salary_slip");
        expect(url).toContain("yearMonth=2026-07");
    });

    it("reads the filename from the Content-Disposition header when present", async () => {
        mockAuthFetch.mockResolvedValueOnce(
            new Response(new Blob(["%PDF-"], { type: "application/pdf" }), {
                status: 200,
                headers: { "Content-Disposition": 'attachment; filename="Salary_Slip_Casey_Cook_Jul2026.pdf"' },
            })
        );

        const result = await downloadSalarySlip(5, "2026-07", slipForm());

        expect(result.filename).toBe("Salary_Slip_Casey_Cook_Jul2026.pdf");
        expect(result.blob).toBeTruthy();
    });

    it("falls back to a deterministic filename when Content-Disposition is missing", async () => {
        mockAuthFetch.mockResolvedValueOnce(
            new Response(new Blob(["%PDF-"], { type: "application/pdf" }), { status: 200 })
        );

        const result = await downloadSalarySlip(5, "2026-07", slipForm());

        expect(result.filename).toBe("Salary_Slip_2026-07.pdf");
    });

    it("reads and decodes the RFC 5987 filename* form when present", async () => {
        mockAuthFetch.mockResolvedValueOnce(
            new Response(new Blob(["%PDF-"], { type: "application/pdf" }), {
                status: 200,
                headers: { "Content-Disposition": "attachment; filename*=UTF-8''Salary_Slip_Casey_Cook_Jul2026.pdf" },
            })
        );

        const result = await downloadSalarySlip(5, "2026-07", slipForm());

        expect(result.filename).toBe("Salary_Slip_Casey_Cook_Jul2026.pdf");
    });

    it("prefers the RFC 5987 filename* form over the plain quoted form when both are present", async () => {
        mockAuthFetch.mockResolvedValueOnce(
            new Response(new Blob(["%PDF-"], { type: "application/pdf" }), {
                status: 200,
                headers: {
                    "Content-Disposition":
                        'attachment; filename="fallback.pdf"; filename*=UTF-8\'\'Salary_Slip_Casey_Cook_Jul2026.pdf',
                },
            })
        );

        const result = await downloadSalarySlip(5, "2026-07", slipForm());

        expect(result.filename).toBe("Salary_Slip_Casey_Cook_Jul2026.pdf");
    });

    it("throws on non-ok status", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 409 }));

        await expect(downloadSalarySlip(5, "2026-07", slipForm())).rejects.toThrow("HTTP 409");
    });
});

// ── patchChannelOverride ──────────────────────────────────────────────────────

describe("patchChannelOverride", () => {
    const payload: ChannelOverridePatch = {
        period: "2026-09", channelKey: "pick up", version: 3,
        orders: 120, grossRevenue: null, appFees: 12.5, note: null,
        clearOrders: false, clearGrossRevenue: false, clearAppFees: false,
    };

    const month: ChannelPerformanceMonth = {
        period: "2026-09", rows: [], totalOrders: 120, totalGrossRevenue: 800,
        totalAppFees: 12.5, totalNetRevenue: 787.5, appFeesMissing: false,
    };

    it("PATCHes the whole upsert body to the channels endpoint, keyed by period and channel", async () => {
        mockAuthFetch.mockResolvedValueOnce(jsonResponse(month, 200));

        await patchChannelOverride(payload);

        const [url, init] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toBe("http://test-api.com/api/business-stats/channels");
        expect(init.method).toBe("PATCH");
        expect(JSON.parse(init.body as string)).toEqual(payload);
    });

    it("returns the server's month, which carries the post-save versions", async () => {
        mockAuthFetch.mockResolvedValueOnce(jsonResponse(month, 200));

        const result = await patchChannelOverride(payload);

        expect(result).toEqual(month);
    });

    it("throws a ChannelRowConflictError on 409", async () => {
        mockAuthFetch.mockResolvedValueOnce(jsonResponse({ message: "stale" }, 409));

        await expect(patchChannelOverride(payload)).rejects.toBeInstanceOf(ChannelRowConflictError);
    });

    it("surfaces the server's reason on a 400", async () => {
        mockAuthFetch.mockResolvedValueOnce(jsonResponse({ message: "App fees cannot be negative" }, 400));

        await expect(patchChannelOverride(payload)).rejects.toThrow("App fees cannot be negative");
    });

    it("says the server had a problem on a 5xx, rather than showing the exception's own text", async () => {
        mockAuthFetch.mockResolvedValueOnce(
            jsonResponse({ message: "could not execute statement [ERROR: numeric field overflow]" }, 500));

        await expect(patchChannelOverride(payload)).rejects.toThrow("the server had a problem — try again in a minute");
    });

    it("names the status when a 4xx carries no readable reason", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 400 }));

        await expect(patchChannelOverride(payload)).rejects.toThrow("the server refused it (error 400)");
    });
});

// ── Business Stats saves: error wording ───────────────────────────────────────

describe.each([
    ["updateCategoryClassification", () => updateCategoryClassification(7, { pnlClass: "OPEX", kpiTag: null })],
    ["updateComponentCost", () => updateComponentCost(7, { cost: 1.5 })],
])("%s errors", (_name, save) => {
    it("surfaces the server's reason on a 400", async () => {
        mockAuthFetch.mockResolvedValueOnce(jsonResponse({ message: "Batch yield must be positive" }, 400));

        await expect(save()).rejects.toThrow("Batch yield must be positive");
    });

    it("says the server had a problem on a 500, never 'Response: 500'", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 500 }));

        await expect(save()).rejects.toThrow("the server had a problem — try again in a minute");
    });

    it("says the row no longer exists on a 404", async () => {
        mockAuthFetch.mockResolvedValueOnce(jsonResponse({ message: "Category not found" }, 404));

        await expect(save()).rejects.toThrow("it no longer exists — reload the page");
    });

    it("says it is a permission problem on a 403", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 403 }));

        await expect(save()).rejects.toThrow("you don't have permission to change this");
    });
});

// ── fetchDeliveryEstimateAccuracy ─────────────────────────────────────────────

describe("fetchDeliveryEstimateAccuracy", () => {
    it("asks the estimate-accuracy endpoint for the given window", async () => {
        mockAuthFetch.mockResolvedValueOnce(
            new Response(JSON.stringify({ deliveredOrders: 0, legs: [] }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            })
        );

        await fetchDeliveryEstimateAccuracy("2026-08-01", "2026-08-30");

        const [url] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toContain("management/delivery/stats/estimate-accuracy");
        expect(url).toContain("start_date=2026-08-01");
        expect(url).toContain("finish_date=2026-08-30");
    });

    /**
     * No branch filter, deliberately. The road half of every quote comes from one router and one
     * speed constant shared by the whole chain, and an unscoped read is also the only one that can
     * see the orders whose branch_id is NULL — which `branch_id IN (...)` can never match. Sending
     * the statistics page's branch selection here would silently narrow the question.
     */
    it("sends no branch filter, so the whole chain is read", async () => {
        mockAuthFetch.mockResolvedValueOnce(
            new Response(JSON.stringify({ deliveredOrders: 0, legs: [] }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            })
        );

        await fetchDeliveryEstimateAccuracy("2026-08-01", "2026-08-30");

        const [url] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        expect(url).not.toContain("branchId");
    });

    it("returns the parsed report on a 200", async () => {
        const report = { deliveredOrders: 3, legs: [] };
        mockAuthFetch.mockResolvedValueOnce(
            new Response(JSON.stringify(report), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            })
        );

        const result = await fetchDeliveryEstimateAccuracy("2026-08-01", "2026-08-30");

        expect(result).toEqual(report);
    });

    it("throws rather than resolving to an empty report when the server refuses", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 403 }));

        await expect(fetchDeliveryEstimateAccuracy("2026-08-01", "2026-08-30")).rejects.toThrow("HTTP 403");
    });
});

// ── fetchDeliverySkipReasonStats ──────────────────────────────────────────────

describe("fetchDeliverySkipReasonStats", () => {
    it("asks the skip-reasons endpoint for the given window", async () => {
        mockAuthFetch.mockResolvedValueOnce(
            new Response(JSON.stringify({ totalSkips: 0, ordersAffected: 0, couriersAffected: 0, byReason: [] }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            })
        );

        await fetchDeliverySkipReasonStats("2026-08-01", "2026-08-30");

        const [url] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toContain("management/delivery/stats/skip-reasons");
        expect(url).toContain("start_date=2026-08-01");
        expect(url).toContain("finish_date=2026-08-30");
    });

    // Chain-wide for the same reason: the staffing question is chain-wide before it is per-branch,
    // and a skip recorded against an order with no branch is only visible unscoped.
    it("sends no branch filter, so the whole chain is read", async () => {
        mockAuthFetch.mockResolvedValueOnce(
            new Response(JSON.stringify({ totalSkips: 0, ordersAffected: 0, couriersAffected: 0, byReason: [] }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            })
        );

        await fetchDeliverySkipReasonStats("2026-08-01", "2026-08-30");

        const [url] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        expect(url).not.toContain("branchId");
    });

    it("returns the parsed report on a 200", async () => {
        const report = { totalSkips: 4, ordersAffected: 2, couriersAffected: 1, byReason: [] };
        mockAuthFetch.mockResolvedValueOnce(
            new Response(JSON.stringify(report), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            })
        );

        const result = await fetchDeliverySkipReasonStats("2026-08-01", "2026-08-30");

        expect(result).toEqual(report);
    });

    it("throws rather than resolving to an empty report when the server refuses", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 500 }));

        await expect(fetchDeliverySkipReasonStats("2026-08-01", "2026-08-30")).rejects.toThrow("HTTP 500");
    });
});

// ── fetchDeliveryZoneStats ────────────────────────────────────────────────────

describe("fetchDeliveryZoneStats", () => {
    const EMPTY_ZONES = { cellMeters: 500, totalOrders: 0, unlocatedOrders: 0, cells: [] };

    function okResponse(body: unknown): Response {
        return new Response(JSON.stringify(body), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    }

    function requestedUrl(): URL {
        const [url] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        return new URL(url);
    }

    // Same names as estimate-accuracy, the card it is read beside: one date range, one spelling.
    it("asks the zones endpoint for the window and the cell size", async () => {
        mockAuthFetch.mockResolvedValueOnce(okResponse(EMPTY_ZONES));

        await fetchDeliveryZoneStats("2026-08-01", "2026-08-30", 250);

        const url = requestedUrl();
        expect(url.pathname).toMatch(/\/management\/delivery\/stats\/zones$/);
        expect(url.searchParams.get("start_date")).toBe("2026-08-01");
        expect(url.searchParams.get("finish_date")).toBe("2026-08-30");
        expect(url.searchParams.get("cellMeters")).toBe("250");
    });

    /**
     * Omitting the branch is the chain-wide read, exactly as on estimate-accuracy — the card it is
     * reconciled against.
     */
    it("sends no branch filter when no branch is given", async () => {
        mockAuthFetch.mockResolvedValueOnce(okResponse(EMPTY_ZONES));

        await fetchDeliveryZoneStats("2026-08-01", "2026-08-30", 500);

        expect(requestedUrl().searchParams.has("branchId")).toBe(false);
    });

    // An empty selection has no branch to scope to; a bare `branchId=` must not reach the server.
    it("treats an empty branch string as no branch filter", async () => {
        mockAuthFetch.mockResolvedValueOnce(okResponse(EMPTY_ZONES));

        await fetchDeliveryZoneStats("2026-08-01", "2026-08-30", 500, "");

        expect(requestedUrl().searchParams.has("branchId")).toBe(false);
    });

    /**
     * Several branches travel as ONE comma-joined `branchId`, the shape every multi-branch call on
     * the statistics page sends — never as a repeated parameter from this client, though the
     * endpoint would bind either.
     */
    it("sends several branches as one comma-joined branchId", async () => {
        mockAuthFetch.mockResolvedValueOnce(okResponse(EMPTY_ZONES));

        await fetchDeliveryZoneStats("2026-08-01", "2026-08-30", 1000, "branch-1,branch-2");

        const url = requestedUrl();
        expect(url.searchParams.getAll("branchId")).toEqual(["branch-1,branch-2"]);
        expect(url.searchParams.get("cellMeters")).toBe("1000");
    });

    it("sends a single branch as a single branchId", async () => {
        mockAuthFetch.mockResolvedValueOnce(okResponse(EMPTY_ZONES));

        await fetchDeliveryZoneStats("2026-08-01", "2026-08-30", 500, "branch-1");

        expect(requestedUrl().searchParams.getAll("branchId")).toEqual(["branch-1"]);
    });

    it("returns the parsed report on a 200", async () => {
        const report = {
            cellMeters: 500,
            totalOrders: 9,
            unlocatedOrders: 1,
            cells: [{
                id: "12:-7",
                center: { latitude: 26.2, longitude: 50.58 },
                vertices: [],
                orders: 9,
                revenue: 41.25,
                avgTotalMinutes: 31.5,
                p90TotalMinutes: 44,
                avgRoadMinutes: 12.1,
                lateShare: 0.222,
                lateSampleSize: 9,
            }],
        };
        mockAuthFetch.mockResolvedValueOnce(okResponse(report));

        const result = await fetchDeliveryZoneStats("2026-08-01", "2026-08-30", 500);

        expect(result).toEqual(report);
    });

    // An unsupported cell size is a 400 on this endpoint; it must surface, not read as an empty map.
    it("throws rather than resolving to an empty map when the server refuses", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 400 }));

        await expect(fetchDeliveryZoneStats("2026-08-01", "2026-08-30", 500)).rejects.toThrow("HTTP 400");
    });
});

// ── Delivery metrics M1–M5 ────────────────────────────────────────────────────

describe("delivery metric fetchers", () => {
    function okResponse(body: unknown): Response {
        return new Response(JSON.stringify(body), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    }

    function requestedUrl(): URL {
        const [url] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        return new URL(url);
    }

    const WINDOW_FETCHERS: Array<[string, (s: string, f: string) => Promise<unknown>, string]> = [
        ["fetchTimeToCourierStats", fetchTimeToCourierStats, "/management/delivery/stats/time-to-courier"],
        ["fetchDeliveryQualityStats", fetchDeliveryQualityStats, "/management/delivery/stats/quality"],
        ["fetchLostDemandStats", fetchLostDemandStats, "/management/delivery/stats/lost-demand"],
        ["fetchCourierProductivity", fetchCourierProductivity, "/management/delivery/stats/courier-productivity"],
    ];

    /**
     * Same parameter names as estimate-accuracy and zones, and no branch: these cards sit beside
     * the chain-wide ones and must count the same orders.
     */
    it.each(WINDOW_FETCHERS)("%s asks its endpoint for the window, chain-wide", async (_name, fetcher, path) => {
        mockAuthFetch.mockResolvedValueOnce(okResponse({}));

        await fetcher("2026-10-01", "2026-10-06");

        const url = requestedUrl();
        expect(url.pathname.endsWith(path)).toBe(true);
        expect(url.searchParams.get("start_date")).toBe("2026-10-01");
        expect(url.searchParams.get("finish_date")).toBe("2026-10-06");
        expect(url.searchParams.has("branchId")).toBe(false);
        const [, init] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
        expect(init.method).toBe("GET");
    });

    it.each(WINDOW_FETCHERS)("%s returns the parsed body on a 200", async (_name, fetcher) => {
        const body = { dataSince: "2026-10-06T15:00:00", coverage: "PARTIAL" };
        mockAuthFetch.mockResolvedValueOnce(okResponse(body));

        await expect(fetcher("2026-10-01", "2026-10-06")).resolves.toEqual(body);
    });

    /** A reversed range is a 400; it must surface as a failure, never as an empty report. */
    it.each(WINDOW_FETCHERS)("%s throws on a non-2xx answer", async (_name, fetcher) => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 400 }));

        await expect(fetcher("2026-10-06", "2026-10-01")).rejects.toThrow("HTTP 400");
    });

    it("asks the lost-demand zones endpoint for the window and the cell size, chain-wide", async () => {
        mockAuthFetch.mockResolvedValueOnce(okResponse({ cells: [] }));

        await fetchLostDemandZoneStats("2026-10-01", "2026-10-06", 250);

        const url = requestedUrl();
        expect(url.pathname).toMatch(/\/management\/delivery\/stats\/lost-demand\/zones$/);
        expect(url.searchParams.get("start_date")).toBe("2026-10-01");
        expect(url.searchParams.get("finish_date")).toBe("2026-10-06");
        expect(url.searchParams.get("cellMeters")).toBe("250");
        expect(url.searchParams.has("branchId")).toBe(false);
    });

    it("throws when the lost-demand zones request is refused", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 500 }));

        await expect(fetchLostDemandZoneStats("2026-10-01", "2026-10-06", 500)).rejects.toThrow("HTTP 500");
    });
});
