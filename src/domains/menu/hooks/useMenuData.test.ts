import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { renderHook, waitFor, act } from "@testing-library/react";
import {fetchBaseAppInfo, fetchPublicBranches} from "../../../shared/api/public";
import {BaseAppInfoResponse} from "../../order/types";
import {IBranch} from "../../management/inventory/types";
import {CHOSEN_BRANCH_KEY} from "../../branch/constants";
import {writeChosenBranch} from "../../branch/utils/customerBranch";
import {useMenuData} from "./useMenuData";

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/public.ts
jest.mock("../../../shared/api/public");


const mockFetchBaseAppInfo = jest.mocked(fetchBaseAppInfo);
const mockFetchPublicBranches = jest.mocked(fetchPublicBranches);

const MENU_RESPONSE: BaseAppInfoResponse = {
    menu: [
        {
            id: 1,
            name: "Margherita",
            category: "Pizzas",
            available: true,
            is_best_seller: false,
            photo: "",
            price: 3.5,
            size: "M",
            description: "Classic pizza",
        },
    ],
    extraIngr: [],
    toppings: [],
    isSDoughAvailable: true,
    userInfo: null,
};

const BRANCHES: IBranch[] = [
    { id: "1", externalId: "ext-1", branchNo: 1, branchName: "Branch One", locale: "en", latitude: null, longitude: null },
];

function makeParams(
    overrides: Partial<{
        userParam: string | null;
        recommendedIds: string[];
        giftId: string | null;
        isKiosk: boolean;
        isEditMode: boolean;
        isAdmin: boolean;
    }> = {},
) {
    return {
        userParam: overrides.userParam ?? null,
        recommendedIds: overrides.recommendedIds ?? [],
        giftId: overrides.giftId ?? null,
        isKiosk: overrides.isKiosk ?? false,
        isEditMode: overrides.isEditMode ?? false,
        isAdmin: overrides.isAdmin ?? false,
        searchParams: new URLSearchParams(),
        setSearchParams: jest.fn<void, [URLSearchParams, ({ replace?: boolean } | undefined)?]>(),
    };
}

describe("useMenuData — initial state", () => {
    beforeEach(() => {
        mockFetchBaseAppInfo.mockResolvedValue(MENU_RESPONSE);
        mockFetchPublicBranches.mockResolvedValue(BRANCHES);
    });

    afterEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
    });

    it("starts in loading state", () => {
        const { result } = renderHook(() => useMenuData(makeParams()));
        expect(result.current.loading).toBe(true);
    });

    it("starts with empty menuData", () => {
        const { result } = renderHook(() => useMenuData(makeParams()));
        expect(result.current.menuData).toEqual([]);
    });

    it("starts with no error", () => {
        const { result } = renderHook(() => useMenuData(makeParams()));
        expect(result.current.error).toBeNull();
    });
});

describe("useMenuData — successful data fetch", () => {
    beforeEach(() => {
        mockFetchBaseAppInfo.mockResolvedValue(MENU_RESPONSE);
        mockFetchPublicBranches.mockResolvedValue(BRANCHES);
    });

    afterEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
    });

    it("calls fetchBaseAppInfo exactly once on mount", async () => {
        renderHook(() => useMenuData(makeParams()));

        await waitFor(() => {
            expect(mockFetchBaseAppInfo).toHaveBeenCalledTimes(1);
        });
    });

    it("calls fetchAllBranches exactly once on mount", async () => {
        renderHook(() => useMenuData(makeParams()));

        await waitFor(() => {
            expect(mockFetchPublicBranches).toHaveBeenCalledTimes(1);
        });
    });

    it("sets loading to false after the fetch completes", async () => {
        const { result } = renderHook(() => useMenuData(makeParams()));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });
    });

    it("populates menuData from the API response", async () => {
        const { result } = renderHook(() => useMenuData(makeParams()));

        await waitFor(() => {
            expect(result.current.menuData).toHaveLength(1);
        });

        expect(result.current.menuData[0].name).toBe("Margherita");
    });

    it("populates availableBranches from fetchAllBranches", async () => {
        const { result } = renderHook(() => useMenuData(makeParams()));

        await waitFor(() => {
            expect(result.current.availableBranches).toHaveLength(1);
        });

        expect(result.current.availableBranches[0].branchName).toBe("Branch One");
    });

    it("reflects isSDoughAvailable from the API response", async () => {
        const { result } = renderHook(() => useMenuData(makeParams()));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.isSDoughAvailable).toBe(true);
    });

    it("leaves error null on success", async () => {
        const { result } = renderHook(() => useMenuData(makeParams()));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.error).toBeNull();
    });
});

describe("useMenuData — fetch error handling", () => {
    afterEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
    });

    it("sets error when fetchBaseAppInfo rejects", async () => {
        mockFetchBaseAppInfo.mockRejectedValue(new Error("Network error"));
        mockFetchPublicBranches.mockResolvedValue([]);

        const { result } = renderHook(() => useMenuData(makeParams()));

        await waitFor(() => {
            expect(result.current.error).toBe("Network error");
        });
    });

    it("sets loading to false even when fetchBaseAppInfo rejects", async () => {
        mockFetchBaseAppInfo.mockRejectedValue(new Error("Timeout"));
        mockFetchPublicBranches.mockResolvedValue([]);

        const { result } = renderHook(() => useMenuData(makeParams()));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });
    });

    it("leaves menuData empty when fetchBaseAppInfo rejects", async () => {
        mockFetchBaseAppInfo.mockRejectedValue(new Error("Timeout"));
        mockFetchPublicBranches.mockResolvedValue([]);

        const { result } = renderHook(() => useMenuData(makeParams()));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.menuData).toEqual([]);
    });
});

describe("useMenuData — userInfo propagation", () => {
    afterEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
    });

    it("sets username from userInfo when name is not 'Unknown user'", async () => {
        mockFetchBaseAppInfo.mockResolvedValue({
            ...MENU_RESPONSE,
            userInfo: { name: "Alice", phone: "+97312345678" },
        });
        mockFetchPublicBranches.mockResolvedValue([]);

        const { result } = renderHook(() => useMenuData(makeParams()));

        await waitFor(() => {
            expect(result.current.username).toBe("Alice");
        });
    });

    it("sets phone from userInfo", async () => {
        mockFetchBaseAppInfo.mockResolvedValue({
            ...MENU_RESPONSE,
            userInfo: { name: "Alice", phone: "+97312345678" },
        });
        mockFetchPublicBranches.mockResolvedValue([]);

        const { result } = renderHook(() => useMenuData(makeParams()));

        await waitFor(() => {
            expect(result.current.phone).toBe("+97312345678");
        });
    });

    it("does not set username when userInfo is null", async () => {
        mockFetchBaseAppInfo.mockResolvedValue({ ...MENU_RESPONSE, userInfo: null });
        mockFetchPublicBranches.mockResolvedValue([]);

        const { result } = renderHook(() => useMenuData(makeParams()));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.username).toBe("");
    });
});

describe("useMenuData — refreshMenu", () => {
    beforeEach(() => {
        mockFetchBaseAppInfo.mockResolvedValue(MENU_RESPONSE);
        mockFetchPublicBranches.mockResolvedValue([]);
    });

    afterEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
    });

    it("calls fetchBaseAppInfo again when refreshMenu is invoked", async () => {
        const { result } = renderHook(() => useMenuData(makeParams()));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        await act(async () => {
            await result.current.refreshMenu();
        });

        // Once on mount, once on refresh
        expect(mockFetchBaseAppInfo).toHaveBeenCalledTimes(2);
    });
});

// task-spec.md §6.1/§6.2 — entry gate + resolveBranchId precedence (ST4).
describe("useMenuData — customer branch entry gate", () => {
    const CHOSEN_BRANCH: IBranch = {
        id: "chosen-1", externalId: "ext-chosen", branchNo: 2, branchName: "Chosen Branch",
        locale: "en", latitude: null, longitude: null,
    };

    beforeEach(() => {
        mockFetchBaseAppInfo.mockResolvedValue(MENU_RESPONSE);
        mockFetchPublicBranches.mockResolvedValue(BRANCHES);
    });

    afterEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
    });

    it("opens the gate for an ordinary customer with no stored branch", async () => {
        const { result } = renderHook(() => useMenuData(makeParams()));

        await waitFor(() => {
            expect(result.current.customerBranchGateOpen).toBe(true);
        });
    });

    it("does not open the gate when a branch is already stored", async () => {
        writeChosenBranch(CHOSEN_BRANCH);

        const { result } = renderHook(() => useMenuData(makeParams()));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.customerBranchGateOpen).toBe(false);
    });

    it("does not open the gate for kiosk mode", async () => {
        const { result } = renderHook(() => useMenuData(makeParams({ isKiosk: true })));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.customerBranchGateOpen).toBe(false);
    });

    it("does not open the gate for admin mode", async () => {
        const { result } = renderHook(() =>
            useMenuData({ ...makeParams({ isAdmin: true }), adminBranchId: "admin-branch-1" })
        );

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.customerBranchGateOpen).toBe(false);
    });

    it("does not open the gate in edit mode", async () => {
        localStorage.setItem("orderToEdit", JSON.stringify({ branch_id: "order-branch-1", items: [] }));

        const { result } = renderHook(() => useMenuData(makeParams({ isEditMode: true })));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.customerBranchGateOpen).toBe(false);
    });
});

// task-spec.md §6.1 — resolveBranchId precedence.
describe("useMenuData — resolveBranchId precedence", () => {
    beforeEach(() => {
        mockFetchBaseAppInfo.mockResolvedValue(MENU_RESPONSE);
        mockFetchPublicBranches.mockResolvedValue(BRANCHES);
    });

    afterEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
    });

    it("uses adminBranchId when isAdmin is true, even if a branch is stored", async () => {
        writeChosenBranch({
            id: "customer-branch", externalId: "ext", branchNo: 3, branchName: "Customer Branch",
            locale: "en", latitude: null, longitude: null,
        });

        renderHook(() =>
            useMenuData({ ...makeParams({ isAdmin: true }), adminBranchId: "admin-branch-1" })
        );

        await waitFor(() => {
            expect(mockFetchBaseAppInfo).toHaveBeenCalledWith(null, "admin-branch-1");
        });
    });

    it("reads branch_id from localStorage.orderToEdit in edit mode", async () => {
        localStorage.setItem("orderToEdit", JSON.stringify({ branch_id: "order-branch-1", items: [] }));

        renderHook(() => useMenuData(makeParams({ isEditMode: true })));

        await waitFor(() => {
            expect(mockFetchBaseAppInfo).toHaveBeenCalledWith(null, "order-branch-1");
        });
    });

    it("uses the stored chosen branch for an ordinary customer", async () => {
        writeChosenBranch({
            id: "customer-branch", externalId: "ext", branchNo: 3, branchName: "Customer Branch",
            locale: "en", latitude: null, longitude: null,
        });

        renderHook(() => useMenuData(makeParams()));

        await waitFor(() => {
            expect(mockFetchBaseAppInfo).toHaveBeenCalledWith(null, "customer-branch");
        });
    });
});
