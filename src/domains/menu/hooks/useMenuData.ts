import { logger } from "../../../shared/utils/logger";
import { useState, useEffect, useRef, Dispatch, SetStateAction } from "react";
import { fetchBaseAppInfo } from "../../../shared/api/public";
import { DEFAULT_BRANCH_ID } from "../../../shared/api/client";
import { fetchAllBranches } from "../../../shared/api/management";
import { imageMap } from "../../../shared/utils/imageMap";
import type { MenuItem, ExtraIngr, Topping, CartItem, Customization } from "../types";
import { parseExtrasNames, splitNote } from "../utils/customizations";
import type { IBranch } from "../../management/inventory/types";
import type { WorkingHoursSchedule } from "../../../shared/api/management";

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

const BRANCH_KEY = 'kiosk_branch_data';

function parseItemNote(rawDesc: string): string {
    // Delegate to the shared note-boundary heuristic (customizations.ts) so this stays in
    // lockstep with localizeDescription.ts, which needs the same boundary to leave the note
    // untouched during localization.
    return splitNote(rawDesc).noteText;
}

function parseExtraIngr(rawDesc: string): string[] {
    // Delegate to the shared additions parser (customizations.ts) so this stays in lockstep
    // with the grammar it emits — it already accepts both the new grouped `+(a, b)` and the
    // legacy `(+X +Y)` shape, and its regexes only ever match `+`-prefixed groups so `-(x)`
    // removal tokens can't be misread as extras.
    return parseExtrasNames(rawDesc);
}

function normalizeComboItem(ci: Partial<CartItem>): {
    id: number | undefined; name: string; category: string; size: string;
    quantity: number; isGarlicCrust: boolean; isThinDough: boolean;
    note: string; extraIngredients: string[]; description: string;
    customizations: Customization[];
} {
    return {
        id: ci?.id, name: ci?.name ?? "", category: ci?.category ?? "", size: ci?.size ?? "",
        quantity: ci?.quantity ?? 1, isGarlicCrust: !!ci?.isGarlicCrust, isThinDough: !!ci?.isThinDough,
        // Prefer the real note field the response now carries; fall back to parsing the legacy
        // `+<note>` tail out of description for pre-migration orders that never had it.
        note: ci?.note ?? parseItemNote(ci?.description ?? ""), extraIngredients: parseExtraIngr(ci?.description ?? ""),
        // Raw description + structural customizations pass through so combo popups can
        // re-hydrate removal state (legacy orders fall back to the `-(x)` tokens in description).
        description: ci?.description ?? "",
        customizations: ci?.customizations ?? [],
    };
}

export function useMenuData(params: UseMenuDataParams): UseMenuDataResult {
    const { userParam, recommendedIds, giftId, isKiosk, isEditMode, searchParams, setSearchParams, isAdmin, adminBranchId } = params;

    // Resolve which branch's availability to load: kiosk uses its selected branch,
    // admin uses the branch it is ordering for, everyone else gets the public default.
    // Mirrors the branch resolution in useCheckout's order creation.
    function resolveBranchId(): string {
        if (isKiosk) {
            try {
                const stored = JSON.parse(localStorage.getItem(BRANCH_KEY) || "{}");
                if (stored?.id) return stored.id;
            } catch {
                // malformed kiosk branch data; fall back to the public default
            }
            return DEFAULT_BRANCH_ID;
        }
        if (isAdmin && adminBranchId) return adminBranchId;
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
    // Guard against React 18 StrictMode invoking this effect twice in development,
    // which would inject the orderToEdit items into the cart more than once.
    const didInit = useRef(false);

    useEffect(() => {
        if (didInit.current) return;
        didInit.current = true;

        async function load(): Promise<void> {
            try {
                setLoading(true);
                const baseInfo = await fetchBaseAppInfo(userParam, resolveBranchId());
                setMenuData(baseInfo.menu);
                setExtraIngredients(baseInfo.extraIngr);
                setToppings(baseInfo.toppings);
                setSDoughAvailable(baseInfo.isSDoughAvailable);
                setWorkingHours(baseInfo.workingHours ?? null);

                const branches = await fetchAllBranches();
                setAvailableBranches(branches);

                if (isKiosk && !localStorage.getItem(BRANCH_KEY)) {
                    setBranchSelector(true);
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
                    const parsed = JSON.parse(rawOrder) as {
                        items: Array<{
                            id: number;
                            name: string;
                            size: string;
                            category: string;
                            isThinDough: boolean;
                            isGarlicCrust: boolean;
                            toppings: Topping[];
                            description: string;
                            note?: string;
                            quantity: number;
                            amount: number | string;
                            discountAmount?: number;
                            photo: string;
                            customizations?: Customization[];
                            comboItemTO?: Array<Partial<CartItem> & { description?: string }>;
                        }>;
                    };
                    if (Array.isArray(parsed.items)) {
                        const normalized = parsed.items.map(item => ({
                            ...item,
                            photo: imageMap[item.name] || item.photo,
                            quantity: item.quantity || 1,
                            discountAmount: item.discountAmount ?? 0,
                            amount: parseFloat(String(item.amount)),
                            // Prefer the real note field the response now carries; fall back to
                            // parsing the legacy `+<note>` tail out of description for
                            // pre-migration orders that never had it.
                            note: item.note ?? parseItemNote(item.description),
                            extraIngredients: parseExtraIngr(item.description),
                            // Structural customizations pass through; legacy orders without them
                            // are re-hydrated by the popups from the `-(x)` description tokens.
                            customizations: item.customizations ?? [],
                            comboItems: Array.isArray(item.comboItemTO)
                                ? item.comboItemTO.map((ci: Partial<CartItem> & { description?: string }) => ({
                                    ...normalizeComboItem(ci),
                                    // ci comes from JSON.parse; photo is present at runtime but not in Partial<CartItem>
                                    photo: imageMap[ci.name ?? ''] || ci.photo,
                                }))
                                : [],
                        }));
                        // safe because: normalized originates from JSON.parse of the orderToEdit localStorage payload,
                        // whose extraIngredients are raw strings rather than ExtraIngr[]; the cart consumes these by
                        // reference at runtime. JSON shape does not structurally overlap CartItem, so a checked double-cast is required.
                        setPendingInitialItems(prev => [...(normalized as unknown as CartItem[]), ...prev]);
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
    };
}
