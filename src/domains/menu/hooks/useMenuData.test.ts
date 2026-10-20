import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { renderHook, waitFor, act } from "@testing-library/react";
import {fetchBaseAppInfo, fetchPublicBranches} from "../../../shared/api/public";
import {BaseAppInfoResponse} from "../../order/types";
import {IBranch} from "../../management/inventory/types";
import {CHOSEN_BRANCH_KEY} from "../../branch/constants";
import {writeChosenBranch} from "../../branch/utils/customerBranch";
import {DEFAULT_BRANCH_ID} from "../../../shared/api/client";
import type {DaySchedule, WorkingHoursSchedule} from "../../../shared/api/management";
import {useMenuData} from "./useMenuData";

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/public.ts
jest.mock("../../../shared/api/public");

// Read through a getter so a describe can switch the entry gate off. It defaults to on, because
// the gate tests below describe how it behaves once a second branch opens.
let mockBranchEntryGateEnabled = true;
// The factory may not call jest.requireActual itself (`jest` is an import from @jest/globals, which
// babel-plugin-jest-hoist treats as out of scope), and it runs before this file's own statements,
// so the real CHOSEN_BRANCH_KEY is read through a getter too.
// Cast: jest.requireActual returns unknown in this jest typing; the module shape is known.
const mockActualBranchConstants = jest.requireActual("../../branch/constants") as typeof import("../../branch/constants");
jest.mock("../../branch/constants", () => ({
    get CHOSEN_BRANCH_KEY() {
        return mockActualBranchConstants.CHOSEN_BRANCH_KEY;
    },
    get BRANCH_ENTRY_GATE_ENABLED() {
        return mockBranchEntryGateEnabled;
    },
}));


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
        mockFetchPublicBranches.mockResolvedValue([...BRANCHES, CHOSEN_BRANCH]);
        writeChosenBranch(CHOSEN_BRANCH);

        const { result } = renderHook(() => useMenuData(makeParams()));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.customerBranchGateOpen).toBe(false);
    });

    it("forgets a stored branch that is no longer offered and asks again", async () => {
        // BRANCHES does not include CHOSEN_BRANCH: it was switched off after the customer chose it.
        writeChosenBranch(CHOSEN_BRANCH);

        const { result } = renderHook(() => useMenuData(makeParams()));

        await waitFor(() => {
            expect(result.current.customerBranchGateOpen).toBe(true);
        });
        expect(localStorage.getItem(CHOSEN_BRANCH_KEY)).toBeNull();
        // The customer's choice in the gate reloads the menu, so the hook does not load it twice.
        expect(mockFetchBaseAppInfo).toHaveBeenCalledTimes(1);
    });

    it("keeps a stored branch when the branch list comes back empty", async () => {
        mockFetchPublicBranches.mockResolvedValue([]);
        writeChosenBranch(CHOSEN_BRANCH);

        const { result } = renderHook(() => useMenuData(makeParams()));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });
        expect(result.current.customerBranchGateOpen).toBe(false);
        expect(localStorage.getItem(CHOSEN_BRANCH_KEY)).not.toBeNull();
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

// Owner, 20 Oct 2026: one branch for now, so the first-visit gate is switched off.
describe("useMenuData — customer branch entry gate switched off", () => {
    const STALE_BRANCH: IBranch = {
        id: "stale-1", externalId: "ext-stale", branchNo: 3, branchName: "Closed Branch",
        locale: "en", latitude: null, longitude: null,
    };

    beforeEach(() => {
        mockBranchEntryGateEnabled = false;
        mockFetchBaseAppInfo.mockResolvedValue(MENU_RESPONSE);
        mockFetchPublicBranches.mockResolvedValue(BRANCHES);
    });

    afterEach(() => {
        mockBranchEntryGateEnabled = true;
        jest.clearAllMocks();
        localStorage.clear();
    });

    it("lets a customer with no stored branch straight into the default branch's menu, storing nothing", async () => {
        const { result } = renderHook(() => useMenuData(makeParams()));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.customerBranchGateOpen).toBe(false);
        expect(localStorage.getItem(CHOSEN_BRANCH_KEY)).toBeNull();
        expect(mockFetchBaseAppInfo).toHaveBeenCalledWith(null, DEFAULT_BRANCH_ID);
        expect(result.current.menuData).toHaveLength(1);
    });

    it("still forgets a stored branch that is no longer offered, without asking again", async () => {
        // BRANCHES does not include STALE_BRANCH: it was switched off after the customer chose it.
        writeChosenBranch(STALE_BRANCH);

        const { result } = renderHook(() => useMenuData(makeParams()));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(localStorage.getItem(CHOSEN_BRANCH_KEY)).toBeNull();
        expect(result.current.customerBranchGateOpen).toBe(false);
    });

    it("reloads the menu, stock and hours from the default branch once the stored one is forgotten", async () => {
        // Nobody is asked to choose again, so nothing else would replace the closed branch's data.
        const STALE_RESPONSE: BaseAppInfoResponse = {
            ...MENU_RESPONSE,
            menu: [{ ...MENU_RESPONSE.menu[0], id: 99, name: "Closed Branch Pizza", available: false }],
            isSDoughAvailable: false,
            workingHours: null,
        };
        const OPEN: DaySchedule = { isOpen: true, shifts: [["11:00", "23:00"]] };
        const DEFAULT_HOURS: WorkingHoursSchedule = {
            Sunday: OPEN, Monday: OPEN, Tuesday: OPEN, Wednesday: OPEN,
            Thursday: OPEN, Friday: OPEN, Saturday: OPEN,
        };
        mockFetchBaseAppInfo.mockImplementation(async (_user: string | null, branchId: string) =>
            branchId === STALE_BRANCH.id ? STALE_RESPONSE : { ...MENU_RESPONSE, workingHours: DEFAULT_HOURS },
        );
        writeChosenBranch(STALE_BRANCH);

        const { result } = renderHook(() => useMenuData(makeParams()));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(mockFetchBaseAppInfo).toHaveBeenNthCalledWith(1, null, STALE_BRANCH.id);
        expect(mockFetchBaseAppInfo).toHaveBeenLastCalledWith(null, DEFAULT_BRANCH_ID);
        expect(result.current.menuData.map((item) => item.name)).toEqual(["Margherita"]);
        expect(result.current.isSDoughAvailable).toBe(true);
        expect(result.current.workingHours).toEqual(DEFAULT_HOURS);
    });

    it("does not load the menu twice when no stored branch was forgotten", async () => {
        const { result } = renderHook(() => useMenuData(makeParams()));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(mockFetchBaseAppInfo).toHaveBeenCalledTimes(1);
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
