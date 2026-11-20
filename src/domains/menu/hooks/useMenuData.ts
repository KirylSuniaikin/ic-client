import { logger } from "../../../shared/utils/logger";
import { useState, useEffect, useRef, Dispatch, SetStateAction } from "react";
import { fetchBaseAppInfo, fetchPublicBranches } from "../../../shared/api/public";
import { DEFAULT_BRANCH_ID } from "../../../shared/api/client";
import type { MenuItem, ExtraIngr, Topping, CartItem } from "../types";
import { hydrateOrderItemsForEdit } from "../utils/hydrateOrderItems";
import type { EditableOrderItem } from "../utils/hydrateOrderItems";
import type { IBranch } from "../../management/inventory/types";
import type { WorkingHoursSchedule } from "../../../shared/api/management";
import type { BaseAppInfoResponse } from "../../order/types";
import { resolveKioskBranchId, readKioskBranch } from "../../kiosk/utils/kioskBranch";
import { clearChosenBranch, readChosenBranch } from "../../branch/utils/customerBranch";
import { BRANCH_ENTRY_GATE_ENABLED } from "../../branch/constants";

export interface UseMenuDataResult {
    menuData: MenuItem[];
    extraIngredients: ExtraIngr[];
    toppings: Topping[];
    isSDoughAvailable: boolean;
    loading: boolean;
    error: string | null;
    username: string;
    phone: string;
    availableBranches: IBranch[];
    branchSelector: boolean | null;
    setBranchSelector: Dispatch<SetStateAction<boolean | null>>;
    pendingInitialItems: CartItem[];
    pendingUnavailableNames: string[];
    refreshMenu: () => Promise<void>;
    workingHours: WorkingHoursSchedule | null;
    customerBranchGateOpen: boolean;
    setCustomerBranchGateOpen: Dispatch<SetStateAction<boolean>>;
}

interface UseMenuDataParams {
    userParam: string | null;
    recommendedIds: string[];
    giftId: string | null;
    isKiosk: boolean;
    isEditMode: boolean;
    searchParams: URLSearchParams;
    setSearchParams: (params: URLSearchParams, options?: { replace?: boolean }) => void;
    isAdmin: boolean;
    adminBranchId?: string | null;
}

export function useMenuData(params: UseMenuDataParams): UseMenuDataResult {
    const { userParam, recommendedIds, giftId, isKiosk, isEditMode, searchParams, setSearchParams, isAdmin, adminBranchId } = params;

    // Resolve which branch's availability to load: kiosk uses its selected branch, admin uses
    // the branch it is ordering for, edit mode inherits the order being edited's own branch
    // (forcing the picker there would let someone edit a branch-A order against branch-B's
    // catalogue), and every ordinary customer gets whatever they chose in the branch picker —
    // falling back to DEFAULT_BRANCH_ID only as a last resort (task-spec.md §6.1).
    function resolveBranchId(): string {
        if (isKiosk) return resolveKioskBranchId();
        if (isAdmin && adminBranchId) return adminBranchId;
        if (isEditMode) {
            const rawOrder = localStorage.getItem("orderToEdit");
            if (rawOrder) {
                try {
                    // JSON.parse returns unknown; shape validated by the `parsed?.branch_id` guard
                    // below, mirroring the defensive parsing of orderToEdit's `items` field further
                    // down in this same effect.
                    const parsed = JSON.parse(rawOrder) as { branch_id?: string };
                    if (parsed?.branch_id) return parsed.branch_id;
                } catch (e) {
                    logger.error("Error parsing orderToEdit for branch resolution:", e);
                }
            }
        } else {
            const chosenBranch = readChosenBranch();
            if (chosenBranch) return chosenBranch.id;
        }
        return DEFAULT_BRANCH_ID;
    }

    const [menuData, setMenuData] = useState<MenuItem[]>([]);
    const [extraIngredients, setExtraIngredients] = useState<ExtraIngr[]>([]);
    const [toppings, setToppings] = useState<Topping[]>([]);
    const [isSDoughAvailable, setSDoughAvailable] = useState(false);
    const [workingHours, setWorkingHours] = useState<WorkingHoursSchedule | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [username, setUsername] = useState("");
    const [phone, setPhone] = useState("");
    const [availableBranches, setAvailableBranches] = useState<IBranch[]>([]);
    const [branchSelector, setBranchSelector] = useState<boolean | null>(null);
    const [pendingInitialItems, setPendingInitialItems] = useState<CartItem[]>([]);
    const [pendingUnavailableNames, setPendingUnavailableNames] = useState<string[]>([]);
    const [customerBranchGateOpen, setCustomerBranchGateOpen] = useState(false);
    // Guard against React 18 StrictMode invoking this effect twice in development,
    // which would inject the orderToEdit items into the cart more than once.
    const didInit = useRef(false);

    useEffect(() => {
        if (didInit.current) return;
        didInit.current = true;

        function applyBaseInfo(baseInfo: BaseAppInfoResponse): void {
            setMenuData(baseInfo.menu);
            setExtraIngredients(baseInfo.extraIngr);
            setToppings(baseInfo.toppings);
            setSDoughAvailable(baseInfo.isSDoughAvailable);
            setWorkingHours(baseInfo.workingHours ?? null);
        }

        async function load(): Promise<void> {
            try {
                setLoading(true);
                const loadedBranchId = resolveBranchId();
                let baseInfo = await fetchBaseAppInfo(userParam, loadedBranchId);
                applyBaseInfo(baseInfo);

                const branches = await fetchPublicBranches();
                setAvailableBranches(branches);

                // A branch can be switched off after a customer chose it (the Saar test branch,
                // 18 Oct 2026). Forget it, so their next order does not go to a shop nobody runs:
                // the entry gate below asks them to choose again, or, while the gate is switched
                // off, the default branch takes over.
                const storedBranch = readChosenBranch();
                if (storedBranch !== null && branches.length > 0 && !branches.some((b) => b.id === storedBranch.id)) {
                    clearChosenBranch();
                    // With the gate on, choosing a branch reloads the menu. With it off nobody is
                    // asked, so reload here, or the stock and working hours on screen stay the
                    // closed branch's while the header and checkout already say the default one.
                    const fallbackBranchId = resolveBranchId();
                    if (!BRANCH_ENTRY_GATE_ENABLED && fallbackBranchId !== loadedBranchId) {
                        baseInfo = await fetchBaseAppInfo(userParam, fallbackBranchId);
                        applyBaseInfo(baseInfo);
                    }
                }

                if (isKiosk && !readKioskBranch()) {
                    setBranchSelector(true);
                }

                // Entry gate (task-spec.md §6.2): an ordinary customer (not kiosk, not admin,
                // not editing an existing order) who has never chosen a branch must choose one
                // before reaching the menu. Switched off while there is only one branch to choose.
                if (BRANCH_ENTRY_GATE_ENABLED && !isKiosk && !isAdmin && !isEditMode && !readChosenBranch()) {
                    setCustomerBranchGateOpen(true);
                }

                let productsToAdd: MenuItem[] = [];
                let giftItem: MenuItem | null | undefined = null;

                if (recommendedIds && recommendedIds.length > 0) {
                    const targetIds = recommendedIds[0].split(",").map((id: string) => parseInt(id, 10));
                    productsToAdd = baseInfo.menu.filter((item: MenuItem) => targetIds.includes(item.id));
                }
                if (giftId) {
                    const targetGiftId = parseInt(giftId, 10);
                    giftItem = baseInfo.menu.find((item: MenuItem) => item.id === targetGiftId);
                }

                const availableItems = productsToAdd.filter(i => i.available);
                const unavItems = productsToAdd.filter(i => !i.available);
                let validGift: MenuItem | null = null;
                if (giftItem) {
                    if (!giftItem.available) unavItems.push(giftItem);
                    else validGift = giftItem;
                }

                const finalCartItems: CartItem[] = [];
                if (availableItems.length > 0) {
                    finalCartItems.push(...availableItems.map((item: MenuItem): CartItem => ({
                        id: item.id, name: item.name, size: item.size,
                        category: item.category, photo: item.photo, amount: item.price, quantity: 1,
                        isThinDough: false, isGarlicCrust: false, extraIngredients: [], toppings: [],
                        note: "", description: "", discountAmount: 0, comboItems: null,
                    })));
                }
                if (validGift) {
                    finalCartItems.push({
                        id: validGift.id, name: validGift.name, size: validGift.size,
                        category: validGift.category, photo: validGift.photo, amount: validGift.price,
                        quantity: 1, discountAmount: 100,
                        isThinDough: false, isGarlicCrust: false, extraIngredients: [], toppings: [],
                        note: "", description: "", comboItems: null,
                    });
                }
                if (finalCartItems.length > 0) setPendingInitialItems(finalCartItems);
                if (unavItems.length > 0) setPendingUnavailableNames(unavItems.map((i: MenuItem) => i.name));

                if (searchParams.has('recommended_items') || searchParams.has('gift')) {
                    searchParams.delete('recommended_items');
                    searchParams.delete('gift');
                    setSearchParams(searchParams, { replace: true });
                }

                if (baseInfo.userInfo?.name && baseInfo.userInfo.name !== "Unknown user") setUsername(baseInfo.userInfo.name);
                if (baseInfo.userInfo?.phone) setPhone(baseInfo.userInfo.phone);
            } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
            } finally {
                setLoading(false);
            }
        }

        load();

        if (isEditMode) {
            const rawOrder = localStorage.getItem("orderToEdit");
            if (rawOrder) {
                try {
                    // JSON.parse returns unknown; shape validated by Array.isArray(parsed.items) below
                    const parsed = JSON.parse(rawOrder) as { items: EditableOrderItem[] };
                    if (Array.isArray(parsed.items)) {
                        const normalized = hydrateOrderItemsForEdit(parsed.items);
                        setPendingInitialItems(prev => [...normalized, ...prev]);
                    }
                } catch (e) {
                    logger.error("Error parsing orderToEdit:", e);
                }
            }
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    async function refreshMenu(): Promise<void> {
        const baseInfo = await fetchBaseAppInfo(null, resolveBranchId());
        setMenuData(baseInfo.menu);
    }

    return {
        menuData, extraIngredients, toppings, isSDoughAvailable,
        loading, error, username, phone, availableBranches, branchSelector, setBranchSelector,
        pendingInitialItems, pendingUnavailableNames, refreshMenu, workingHours,
        customerBranchGateOpen, setCustomerBranchGateOpen,
    };
}
