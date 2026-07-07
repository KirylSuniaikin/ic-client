import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { renderHook, waitFor, act } from "@testing-library/react";
import {fetchBaseAppInfo} from "../../../shared/api/public";
import {fetchAllBranches} from "../../../shared/api/management";
import {BaseAppInfoResponse} from "../../order/types";
import {IBranch} from "../../management/inventory/types";
import {useMenuData} from "./useMenuData";

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/public.ts
jest.mock("../../../shared/api/public");
// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/management.ts
jest.mock("../../../shared/api/management");


const mockFetchBaseAppInfo = jest.mocked(fetchBaseAppInfo);
const mockFetchAllBranches = jest.mocked(fetchAllBranches);

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
    { id: "1", externalId: "ext-1", branchNo: 1, branchName: "Branch One", locale: "en" },
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
        mockFetchAllBranches.mockResolvedValue(BRANCHES);
    });

    afterEach(() => {
        jest.clearAllMocks();
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
        mockFetchAllBranches.mockResolvedValue(BRANCHES);
    });

    afterEach(() => {
        jest.clearAllMocks();
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
            expect(mockFetchAllBranches).toHaveBeenCalledTimes(1);
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
    });

    it("sets error when fetchBaseAppInfo rejects", async () => {
        mockFetchBaseAppInfo.mockRejectedValue(new Error("Network error"));
        mockFetchAllBranches.mockResolvedValue([]);

        const { result } = renderHook(() => useMenuData(makeParams()));

        await waitFor(() => {
            expect(result.current.error).toBe("Network error");
        });
    });

    it("sets loading to false even when fetchBaseAppInfo rejects", async () => {
        mockFetchBaseAppInfo.mockRejectedValue(new Error("Timeout"));
        mockFetchAllBranches.mockResolvedValue([]);

        const { result } = renderHook(() => useMenuData(makeParams()));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });
    });

    it("leaves menuData empty when fetchBaseAppInfo rejects", async () => {
        mockFetchBaseAppInfo.mockRejectedValue(new Error("Timeout"));
        mockFetchAllBranches.mockResolvedValue([]);

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
    });

    it("sets username from userInfo when name is not 'Unknown user'", async () => {
        mockFetchBaseAppInfo.mockResolvedValue({
            ...MENU_RESPONSE,
            userInfo: { name: "Alice", phone: "+97312345678" },
        });
        mockFetchAllBranches.mockResolvedValue([]);

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
        mockFetchAllBranches.mockResolvedValue([]);

        const { result } = renderHook(() => useMenuData(makeParams()));

        await waitFor(() => {
            expect(result.current.phone).toBe("+97312345678");
        });
    });

    it("does not set username when userInfo is null", async () => {
        mockFetchBaseAppInfo.mockResolvedValue({ ...MENU_RESPONSE, userInfo: null });
        mockFetchAllBranches.mockResolvedValue([]);

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
        mockFetchAllBranches.mockResolvedValue([]);
    });

    afterEach(() => {
        jest.clearAllMocks();
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
