import {useEffect, useRef, useState} from "react";
import {Badge, Box, Fab, IconButton} from "@mui/material";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import {useSearchParams} from 'react-router-dom';
import {useNavigate} from "react-router-dom";
import MenuItemCardHorizontal from "./components/MenuItemCardHorizontal";
import CartComponent from "./components/CartComponent";
import PizzaPopup from "./components/PizzaPopupContent";
import {checkCustomer, createOrder, editOrder, fetchBaseAppInfo, URL} from "./api/api";
import {groupItemsByCategory} from "./services/item_services";
import ComboPopup from "./components/ComboPopupContent";
import ClientInfoPopup from "./components/ClientInfoPopup";
import AdminOrderDetailsPopUp from "./adminComponents/AdminOrderDetailsPopUp";
import GenericItemPopupContent from "./components/GenericItemPopupContent";
import CloseIcon from "@mui/icons-material/Close";
import OrderConfirmed from "./components/OrderConfirmed";
import PizzaLoader from "./components/loadingAnimations/PizzaLoader";
import CrossSellPopup from "./components/CrossSellPopup";
import {groupAvailableItemsByName} from "./utils/menu_service";
import {isWithinWorkingHours} from "./components/scheduleComponents/isWithinWorkingHours";
import {imageMap} from "./utils/imageMap";
import ClosedPopup from "./components/scheduleComponents/ClosedPopup";
import {TextButton, TextGroup, TextTitle} from "./utils/typography";
import {PizzaComboPopup} from "./components/comboComponents/PizzaComboPopup";
import {DetroitComboPopup} from "./components/comboComponents/DetroitComboPopup";
import {UpsellPopup} from "./components/UpSellPopup";
import {PickUpReminderPopup} from "./components/PickUpReminderPopup";
import {fetchAllBranches, getAllBannedCstmrs} from "./management/api/api";
import {KioskBranchSelector} from "./components/KioskBranchSelector";
import BlackListSnackBar from "./components/BlackListSnackBar";
import RamadanPopup from "./components/RamadanPopup";
import {UnavailablePopup} from "./components/UnavailablePopup";
import ErrorSnackbar from "./adminComponents/ErrorSnackbar";
import * as React from "react";
import {BaguettePizzaPopup} from "./components/BaguettePizzaPopup";
import {RamadanInfoPopup} from "./components/RamadanInfoPopup";
import type { MenuItem, CartItem, ComboItem, ExtraIngr, Topping, Group } from './management/types/menuTypes';
import type { IBranch } from './management/types/inventoryTypes';
import {CreateOrderRequest, EditOrderRequest, Order} from "./types/orderTypes";

interface HomePageProps {
    userParam: string | null;
    recommendedIds: string[];
    giftId: string | null;
}

type PopupGroup = Group | MenuItem | MenuItem[] | null;

const brandRed = "#E44B4C";

function parseItemNoteOuter(desc: string): string {
    let note = "";

    const hasParentheses = /\(.*?\)/.test(desc);
    let restPart = desc;

    if (hasParentheses) {
        const lastParenIndex = desc.lastIndexOf(")");
        restPart = desc.substring(lastParenIndex + 1);
    }

    const plusRegex = /\+([^+]+)/g;
    let match;
    while ((match = plusRegex.exec(restPart)) !== null) {
        let text = match[1].trim();
        if (text !== "Thin") {
            note += (note ? " " : "") + text;
        }
    }
    return note.trim();
}

function parseExtraIngrOuter(desc: string): string[] {
    const extras: string[] = [];
    const regex = /\((.*?)\)/g;
    let match;
    while ((match = regex.exec(desc)) !== null) {
        const ingr = match[1]
            .split("+")
            .map((s: string) => s.trim())
            .filter((s: string) => s.length > 0);
        extras.push(...ingr);
    }
    return extras;
}

function normalizeComboItem(ci: Partial<CartItem> & { id?: number; description?: string }): {
    id: number | undefined;
    name: string;
    category: string;
    size: string;
    quantity: number;
    isGarlicCrust: boolean;
    isThinDough: boolean;
    note: string;
    extraIngredients: string[];
} {
    return {
        id: ci?.id,
        name: ci?.name ?? "",
        category: ci?.category ?? "",
        size: ci?.size ?? "",
        quantity: ci?.quantity ?? 1,
        isGarlicCrust: !!ci?.isGarlicCrust,
        isThinDough: !!ci?.isThinDough,
        note: parseItemNoteOuter(ci?.description ?? ""),
        extraIngredients: parseExtraIngrOuter(ci?.description ?? "")
    };
}

function isCustomerBanned(blackList: Array<{ telephoneNo: string }>, phoneNumber: string): boolean {
    for (let i = 0; i < blackList.length; i++) {
        if (blackList[i].telephoneNo === phoneNumber) {
            return true;
        }
    }
    return false;
}

function HomePage({userParam, recommendedIds, giftId}: HomePageProps): JSX.Element {
    const [menuData, setMenuData] = useState<MenuItem[]>([]);
    const [extraIngredients, setExtraIngredients] = useState<ExtraIngr[]>([]);
    const [toppings, setToppings] = useState<Topping[]>([]);
    const [cartItems, setCartItems] = useState<CartItem[]>([]);
    const [cartOpen, setCartOpen] = useState(false);
    const [username, setUsername] = useState("");
    const [phone, setPhone] = useState("");

    const [pizzaPopupOpen, setPizzaPopupOpen] = useState(false);
    const [comboPopupOpen, setComboPopupOpen] = useState(false);
    const [pizzaComboPopupOpen, setPizzaComboPopupOpen] = useState(false);
    const [detroitComboPopupOpen, setDetroitComboPopupOpen] = useState(false);
    const [genericPopupOpen, setGenericPopupOpen] = useState(false);
    const [popupGroup, setPopupGroup] = useState<PopupGroup>(null);
    const [editItem, setEditItem] = useState<CartItem | null>(null);
    const [phonePopupOpen, setPhonePopupOpen] = useState(false);
    const [adminOrderDetailsPopUp, setAdminOrderDetailsPopUpOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editMode, setEditMode] = useState(false)
    const [closedPopup, setClosedPopupOpen] = useState(false);
    const [ramadanPopupOpen ,setRamadanPopupOpen] = useState(false);
    const [ramadanInfoPopupOpen ,setRamadanInfoPopupOpen] = useState(false);

    const [unavailableItems, setUnavailableItems] = useState<string[]>([]);

    const [searchParams, setSearchParams] = useSearchParams();
    const isAdmin = searchParams.get('isAdmin') === 'true';
    const isKiosk = searchParams.get('mode') === 'kiosk';
    const adminBranchId = searchParams.get('branchId');
    const isEditMode = searchParams.get('isEditMode') === 'true';
    const isAdminConfirmedRef = useRef(false);
    const navigate = useNavigate();
    const [showOrderConfirmed, setShowOrderConfirmed] = useState(false);
    const [wasCrossSellShown, setWasCrossSellShown] = useState(false);
    const [isCrossSellOpen, setIsCrossSellOpen] = useState(false);
    const generalCrossSell = ["Hot Honey Sauce", "Ranch Sauce", "Coca Cola Zero"]
    const finalCrossSell = ["BBQ Chicken Ranch Detroit Brick", "Coca Cola Zero", "Ranch Sauce", "Hot Honey Sauce", "Pizza Rolls", "Water"]

    const [upsellPopupOpen, setUpsellPopupOpen] = useState(false);
    const [upsellItem, setUpsellItem] = useState<CartItem | null>(null);
    const [upsellType, setUpsellType] = useState<string | null>(null);
    const [pendingItems, setPendingItems] = useState<CartItem | CartItem[] | null>(null);
    const [comboOfferPhoto, setComboOfferPhoto] = useState<string | null>(null);
    const [comboPrice, setComboPrice] = useState<number | null>(null);
    const [pickUpReminder, setPickUpReminder] = useState(false);
    const [pendingOrder, setPendingOrder] = useState<unknown>(null);
    const [unavailablePopupOpen, setUnavailablePopupOpen] = useState(false);
    const [baguettePizzaPopupOpen,setBaguettePizzaPopupOpen]= useState(false);

    const [branchSelector, setBranchSelector] = useState<boolean | null>(null);
    const [availableBranches, setAvailableBranches] = useState<IBranch[]>([]);
    const BRANCH_KEY = 'kiosk_branch_data';
    const [blacklistSnackBarOpen, setBlacklistSnackBarOpen] = useState(false);

    const [isSDoughAvailable, setSDoughAvailable] = useState(false);
    const [isMDoughAvailable, setMDoughAvailable] = useState(false);

    const [errorSnackBarOpen, setErrorSnackBarOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState('Error occurred placing an order');

    const bestRef = useRef<HTMLDivElement | null>(null);

    // groupItemsByCategory expects GroupWithMeta[] (has category + is_best_seller);
    // groupAvailableItemsByName returns Group[] typed but runtime objects carry those fields
    const {
        bestsellers,
        brickPizzas,
        combos,
        pizzas,
        sides,
        beverages,
        sauces,
        ramadan,
        pizzaBaguettes
    } = groupItemsByCategory(groupAvailableItemsByName(menuData) as Parameters<typeof groupItemsByCategory>[0]);

    const handleDiscountChange = (item: CartItem, newDiscount: number): void => {
        const updatedItems = cartItems.map((i) =>
            i === item ? {...i, discountAmount: newDiscount} : i
        );
        setCartItems(updatedItems as CartItem[]);
    };
    const FB_PIXEL_ID = '1717861405707714';
    const TT_PIXEL_ID = 'D1SBUPRC77U25MKH1E40';

    useEffect(() => {
        if (!window.fbq) {
            (function (f, b, e, v, n, t, s) {
                // Facebook Pixel SDK snippet — uses dynamic property assignment on window
                if ((f as Record<string, unknown>)['fbq']) return;
                n = (f as Record<string, unknown>)['fbq'] = function () {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (n as any).callMethod ? (n as any).callMethod.apply(n, arguments) : (n as any).queue.push(arguments);
                };
                if (!(f as Record<string, unknown>)['_fbq']) (f as Record<string, unknown>)['_fbq'] = n;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (n as any).push = n;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (n as any).loaded = !0;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (n as any).version = '2.0';
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (n as any).queue = [];
                t = (b as Document).createElement(e as string) as unknown as typeof t;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (t as any).async = !0;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (t as any).src = v;
                s = (b as Document).getElementsByTagName(e as string)[0];
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (s as any).parentNode.insertBefore(t, s);
            })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js', undefined, undefined, undefined);
        }

        window.fbq?.('init', FB_PIXEL_ID);
        window.fbq?.('track', 'PageView');

        if (!window.ttq) {
            (function (w, d, t) {
                // TikTok Pixel SDK snippet — uses dynamic method assignment
                (w as Record<string, unknown>)['TiktokAnalyticsObject'] = t;
                const ttq = (w as Record<string, unknown>)[t] = (w as Record<string, unknown>)[t] || [];
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (ttq as any).methods = [
                    "page", "track", "identify", "instances", "debug", "on", "off",
                    "once", "ready", "alias", "group", "enableCookie", "disableCookie",
                    "holdConsent", "revokeConsent", "grantConsent"
                ];
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (ttq as any).setAndDefer = function (t: Record<string, unknown>, e: string) {
                    t[e] = function () {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (t as any).push([e].concat(Array.prototype.slice.call(arguments, 0)));
                    };
                };
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                for (let i = 0; i < (ttq as any).methods.length; i++) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (ttq as any).setAndDefer(ttq, (ttq as any).methods[i]);

                }

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (ttq as any).load = function (e: string, n: unknown) {
                    const r = "https://analytics.tiktok.com/i18n/pixel/events.js";
                    const script = (d as Document).createElement("script");
                    script.type = "text/javascript";
                    script.async = true;
                    script.src = `${r}?sdkid=${e}&lib=${t}`;
                    const f = (d as Document).getElementsByTagName("script")[0];
                    f.parentNode?.insertBefore(script, f);
                };

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (ttq as any).load(TT_PIXEL_ID);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (ttq as any).page();
            })(window, document, 'ttq');
        }

        async function load(): Promise<void> {
            try {
                setLoading(true);
                const baseInfo = await fetchBaseAppInfo(userParam, '2e8c35f7-d75e-4442-b496-cbb929842c10');
                setMenuData(baseInfo.menu);
                setExtraIngredients(baseInfo.extraIngr)
                setToppings(baseInfo.toppings)
                setSDoughAvailable(baseInfo.isSDoughAvailable)
                setMDoughAvailable(baseInfo.isMDoughAvailable)
                const branches = await fetchAllBranches()
                setAvailableBranches(branches);

                if (isKiosk) {
                    const savedBranch = localStorage.getItem(BRANCH_KEY);

                    if (!savedBranch) {
                        setBranchSelector(true);
                    } else {
                        console.log("Kiosk initialized for branch:", JSON.parse(savedBranch).branchName);
                    }
                }
                let productsToAdd: MenuItem[] = []
                let giftItem: MenuItem | null | undefined = null

                if (recommendedIds && recommendedIds.length > 0) {
                    const targetIds = recommendedIds[0].split(",").map((id: string) => parseInt(id, 10));

                    productsToAdd = Object.values(baseInfo.menu).filter((item: MenuItem) => targetIds.includes(item.id));
                }

                if (giftId) {
                    const targetGiftId = parseInt(giftId, 10)
                    giftItem = Object.values(baseInfo.menu).find((item: MenuItem) => item.id === targetGiftId);
                }

                addWhatsappItems(productsToAdd, giftItem ?? null);

                if (searchParams.has('recommended_items') || searchParams.has('gift')) {
                    searchParams.delete('recommended_items');
                    searchParams.delete('gift');

                    setSearchParams(searchParams, {replace: true});
                }

                if (baseInfo.userInfo && baseInfo.userInfo.name && baseInfo.userInfo.name !== "Unknown user") {
                    setUsername(baseInfo.userInfo.name)
                }
                if (baseInfo.userInfo && baseInfo.userInfo.phone) {
                    setPhone(baseInfo.userInfo.phone);
                }
            } catch (err) {
                setError((err as Error).message);
            } finally {
                setLoading(false);
            }
        }

        load();

        if (isEditMode) {
            const rawOrder = localStorage.getItem("orderToEdit");
            if (rawOrder) {
                try {
                    const parsed = JSON.parse(rawOrder) as {
                        items: Array<{
                            discountAmount?: number;
                            amount: number | string;
                            quantity: number;
                            description: string;
                            comboItemTO?: Array<Partial<CartItem> & { description?: string }>;
                            [key: string]: unknown;
                        }>;
                    };
                    if (Array.isArray(parsed.items)) {
                        const normalized = parsed.items.map(item => {
                            const pct = item.discountAmount ?? item.discountAmount ?? 0;
                            return {
                                ...item,
                                photo: imageMap[(item.name as string)] || item.photo,
                                quantity: item.quantity || 1,
                                discountAmount: pct,
                                amount: parseFloat(String(item.amount)),
                                note: parseItemNoteOuter(item.description),
                                extraIngredients: parseExtraIngrOuter(item.description),
                                comboItems: Array.isArray(item.comboItemTO)
                                    ? item.comboItemTO.map((ci: Partial<CartItem> & { description?: string }) => ({
                                        ...normalizeComboItem(ci),
                                        photo: imageMap[(ci.name as string)] || (ci as Record<string, unknown>)['photo']
                                    }))
                                    : []
                            };
                        });
                        setCartItems(normalized as unknown as CartItem[]);
                    }
                } catch (e) {
                    console.error("Error:", e);
                }
            }
        }

    }, []);


    function parseItemNote(desc: string): string {
        let note = "";

        const hasParentheses = /\(.*?\)/.test(desc);
        let restPart = desc;

        if (hasParentheses) {
            const lastParenIndex = desc.lastIndexOf(")");
            restPart = desc.substring(lastParenIndex + 1);
        }

        const plusRegex = /\+([^+]+)/g;
        let match;
        while ((match = plusRegex.exec(restPart)) !== null) {
            let text = match[1].trim();
            if (text !== "Thin") {
                note += (note ? " " : "") + text;
            }
        }
        return note.trim();
    }

    function parseExtraIngr(desc: string): string[] {
        const extras: string[] = [];
        const regex = /\((.*?)\)/g;
        let match;
        while ((match = regex.exec(desc)) !== null) {
            const ingr = match[1]
                .split("+")
                .map((s: string) => s.trim())
                .filter((s: string) => s.length > 0);
            extras.push(...ingr);
        }
        return extras;
    }


    const totalPrice = cartItems
        ? cartItems.reduce((acc, i) => {
            const discount = i.discountAmount || 0;
            const discountedPrice = i.amount * (1 - discount / 100);
            return acc + discountedPrice * i.quantity;
        }, 0).toFixed(2)
        : 0;

    useEffect(() => {
        if (cartItems.length === 0) {
            setCartOpen(false);
        }
    }, [cartItems]);

    if (loading) return <PizzaLoader/>;
    if (error) return <div>Error: {error}</div>;

    function getGeneralCrossSellItems(): MenuItem[] {
        return generalCrossSell
            .map((name: string) => menuData.find((item: MenuItem) => item.name === name && item.available))
            .filter(Boolean) as MenuItem[];
    }

    function getFinalCrossSell(): MenuItem[] {
        return finalCrossSell
            .map((name: string) => menuData.find((item: MenuItem) => item.name === name && item.available))
            .filter(Boolean) as MenuItem[];
    }

    function openPizzaEditPopUp(item: CartItem): void {
        setEditItem(item)
        setEditMode(true)
        setPizzaPopupOpen(true)
        setPopupGroup(pizzas.find((group: Group) =>
            group.items.some((i: MenuItem) => i.name === item.name)
        ) ?? null)
    }

    function openPizzaComboEditPopup(item: CartItem): void {
        setEditItem(item)
        setEditMode(true)
        const comboVariants = menuData.filter((m: MenuItem) => m.name === item.name && m.category === "Combo Deals");
        setPopupGroup(comboVariants);
        setPizzaComboPopupOpen(true)
    }

    function openDetroitComboEditPopup(item: CartItem): void {
        setEditItem(item)
        setEditMode(true)
        const comboVariants = menuData.filter((m: MenuItem) => m.name === item.name && m.category === "Combo Deals");
        setPopupGroup(comboVariants);
        setDetroitComboPopupOpen(true)
    }

    function getSameItems(item_name: string): MenuItem[] {
        const sameItems: MenuItem[] = [];
        menuData.forEach((item: MenuItem) => {
            if (item.name === item_name) {
                sameItems.push(item);
            }
        });
        return sameItems;
    }

    function addWhatsappItems(productsToAdd: MenuItem[], giftProduct: MenuItem | null): void {
        const {availableItems, unavailableItems: unavItems} = productsToAdd.reduce<{
            availableItems: MenuItem[];
            unavailableItems: MenuItem[];
        }>((acc, item) => {
            if(item.available){
                acc.availableItems.push(item);
            }
            else{
                acc.unavailableItems.push(item);
            }
            return acc;
        },
        {availableItems: [], unavailableItems: []}
        );

        let validGift: MenuItem | null = null;
        if(giftProduct) {
            if (!giftProduct.available) {
                unavItems.push(giftProduct);
            } else {
                validGift = giftProduct
            }
        }

        const finalCartItems: CartItem[] = [];

        if (availableItems.length > 0) {
            const items = availableItems.map((item: MenuItem) => ({
                id: item.id,
                name: item.name,
                size: item.size ? item.size : "",
                category: item.category,
                photo: item.photo,
                amount: item.price,
                quantity: 1,
            }));

            // WhatsApp items are partial CartItem shapes; cast via unknown since they don't have all fields
            finalCartItems.push(...items as unknown as CartItem[]);
        }

        if (validGift !== null) {
            // gift item is a partial CartItem shape; cast via unknown since not all fields are present
            finalCartItems.push({
                id: validGift.id,
                name: validGift.name,
                size: validGift.size,
                category: validGift.category,
                quantity: 1,
                photo: validGift.photo,
                amount: validGift.price,
                discount: 100,
            } as unknown as CartItem);
        }

        if(finalCartItems.length > 0) {
            handleAddToCart(finalCartItems, true);
        }

        if (unavItems.length > 0) {
            setUnavailableItems(unavItems.map((item: MenuItem) => (item.name)));
            setUnavailablePopupOpen(true)
        }
    }

    const handleOpenCart = (): void => {
        if (!isWithinWorkingHours() && !isAdmin) {
            setClosedPopupOpen(true);
        } else {
            setCartOpen(true);
        }
    };
    const handleCloseCart = (): void => setCartOpen(false);

    const handleOpenPopup = (item: Group | MenuItem, _menuItem?: MenuItem): void => {
        const menuItem = item as MenuItem;
        if (menuItem.category === "Pizzas") {
            setPopupGroup(item);
            setPizzaPopupOpen(true);
        } else if (menuItem.category === "Combo Deals") {
            if (menuItem.name === "Pizza Combo") {
                const comboVariants = menuData.filter((m: MenuItem) => m.name === menuItem.name && m.category === "Combo Deals");
                setPopupGroup(comboVariants);
                setPizzaComboPopupOpen(true);
            } else if (menuItem.name === "Detroit Combo") {

                setPopupGroup(item);
                setDetroitComboPopupOpen(true);
            }
        }
        else if (menuItem.category === "Ramadan") {
            setPopupGroup(item);
            setRamadanPopupOpen(true);
        }
        else if (menuItem.category === "Baguette Pizzas") {
            setPopupGroup(item);
            setBaguettePizzaPopupOpen(true);
        }
        else {
            setPopupGroup(item);
            setGenericPopupOpen(true);
        }
    };

    function handleClosePizzaPopup(): void {
        setPizzaPopupOpen(false);
        setPopupGroup(null);
        setEditMode(false);
    }

    function handleClosePizzaComboPopup(): void {
        setPizzaComboPopupOpen(false);
        setPopupGroup(null);
    }

    const handleCloseDetroitComboPopup = (): void => {
        setDetroitComboPopupOpen(false)
        setPopupGroup(null)
    }

    function handleCloseComboPopup(): void {
        setComboPopupOpen(false);
        setPopupGroup(null);
    }

    const handleCloseGenericPopup = (): void => {
        setGenericPopupOpen(false);
        setPopupGroup(null);
    }

    const handleClosePhonePopup = (): void => {
        setPhonePopupOpen(false);
    }

    function handleAddToCart(items: CartItem | CartItem[], upsellDeclined?: boolean): void {
        const arr = Array.isArray(items) ? items : [items];

        const pizzaItem = arr.find((it: CartItem) => it.category === "Pizzas");
        const brickItem = arr.find((it: CartItem) => it.category === "Brick Pizzas");

        if (pizzaItem && !upsellDeclined) {
            const combo = menuData.find((it: MenuItem) => it.name === "Pizza Combo" && it.size === pizzaItem.size)
            setComboOfferPhoto(combo?.photo ?? null)
            setComboPrice(combo?.price ?? null)
            setPendingItems(items)
            setUpsellItem(pizzaItem);
            setUpsellType("pizza");
            setUpsellPopupOpen(true);
            return;
        }

        if (brickItem && !upsellDeclined) {
            const combo = menuData.find((it: MenuItem) => it.name === "Detroit Combo")
            setComboOfferPhoto(combo?.photo ?? null)
            setComboPrice(combo?.price ?? null)
            setPendingItems(items)
            setUpsellItem(brickItem);
            setUpsellType("brick");
            setUpsellPopupOpen(true);
            return;
        }

        setCartItems(prev => {
            const updated = [...prev];

            arr.forEach((item: CartItem) => {
                const typedItem = item as CartItem & { id?: number; comboItems?: CartItem[] };
                const idx = updated.findIndex((it: CartItem) =>
                    it.name === item.name &&
                    (it.discountAmount || 0) === (item.discountAmount || 0)
                );

                if (idx === -1) {
                    updated.push({...item});
                    return;
                }

                const existing = updated[idx] as CartItem & { comboItems?: CartItem[] };

                if (item.category !== "Combo Deals" && item.category !== "Pizzas") {
                    updated[idx] = {
                        ...existing,
                        quantity: existing.quantity + item.quantity,
                    };
                    return;
                }

                if (item.category === "Combo Deals" && item.name === "Detroit Combo") {
                    console.log("[LOG]Started to compare Detroit Combo");
                    const sameComboItems =
                        existing.comboItems?.[0]?.name === typedItem.comboItems?.[0]?.name &&
                        existing.comboItems?.[1]?.name === typedItem.comboItems?.[1]?.name &&
                        existing.comboItems?.[2]?.name === typedItem.comboItems?.[2]?.name;

                    if (sameComboItems) {
                        updated[idx] = {
                            ...existing,
                            quantity: existing.quantity + item.quantity,
                        };
                    } else {
                        updated.push({...item});
                    }
                    return;
                }

                if (item.category === "Combo Deals" && item.name === "Pizza Combo") {
                    if (existing.description !== item.description || existing.size !== item.size) {
                        updated.push({...item});
                        return;
                    }

                    const sameComboItems =
                        existing.comboItems?.[0]?.name === typedItem.comboItems?.[0]?.name &&
                        (existing.comboItems?.[0] as CartItem & { isGarlicCrust?: boolean })?.isGarlicCrust === (typedItem.comboItems?.[0] as CartItem & { isGarlicCrust?: boolean })?.isGarlicCrust &&
                        (existing.comboItems?.[0] as CartItem & { isThinDough?: boolean })?.isThinDough === (typedItem.comboItems?.[0] as CartItem & { isThinDough?: boolean })?.isThinDough &&
                        existing.comboItems?.[1]?.name === typedItem.comboItems?.[1]?.name &&
                        existing.comboItems?.[2]?.name === typedItem.comboItems?.[2]?.name;

                    if (sameComboItems) {
                        updated[idx] = {
                            ...existing,
                            quantity: existing.quantity + item.quantity,
                        };
                    } else {
                        updated.push({...item});
                    }
                    return;
                }

                if (item.category === "Pizzas") {
                    const typedExisting = existing as CartItem & { isThinDough?: boolean; isGarlicCrust?: boolean };
                    const typedNew = item as CartItem & { isThinDough?: boolean; isGarlicCrust?: boolean };
                    const baseChanged =
                        existing.description !== item.description ||
                        existing.size !== item.size ||
                        typedExisting.isThinDough !== typedNew.isThinDough ||
                        typedExisting.isGarlicCrust !== typedNew.isGarlicCrust;

                    if (baseChanged) {
                        updated.push({...item});
                        return;
                    }

                    const existingExtras = existing.extraIngredients || [];
                    const newExtras = item.extraIngredients || [];

                    if (existingExtras.length === 0 && newExtras.length === 0) {
                        updated[idx] = {
                            ...existing,
                            quantity: existing.quantity + item.quantity,
                        };
                        return;
                    }

                    if (existingExtras.length !== newExtras.length) {
                        updated.push({...item});
                        return;
                    }

                    const allExtrasMatch = existingExtras.every((ingredient: ExtraIngr) =>
                        newExtras.some((it: ExtraIngr) => it.name === ingredient.name)
                    );

                    if (!allExtrasMatch) {
                        updated.push({...item});
                        return;
                    }

                    updated[idx] = {
                        ...existing,
                        quantity: existing.quantity + item.quantity,
                        amount: existing.amount + item.amount,
                    };

                    return;
                }

                updated.push({...item});
            });

            return updated;

        });

        handleClosePizzaPopup();
        const firstItem = arr[0] as CartItem & { price?: number; id?: number };
        if (firstItem) {
            window.ttq?.track('AddToCart', {
                content_id: firstItem.name,
                content_type: 'product',
                value: firstItem.price,
                currency: 'BHD'
            });
            window.fbq?.('track', 'AddToCart', {
                content_ids: [firstItem.id ?? firstItem.name],
                content_name: firstItem.name,
                content_type: 'product',
                value: firstItem.price,
                currency: 'BHD',
            });
        }

        setPendingItems(null);
    }

    function removeFromCart(name: string, amount: number, quantity: number): void {
        setCartItems(prev =>
            prev.filter((item: CartItem) =>
                !(item.name === name && item.amount === amount && item.quantity === quantity)
            )
        );
    }

    function handleRemoveItemFromCart(item: CartItem): void {
        setCartItems(prev => prev.filter((it: CartItem) => it !== item));
    }

    function handleChangeQuantity(item: CartItem, newQty: number): void {
        if (newQty < 1) return;

        if (!isAdmin && item.discountAmount === 100 && newQty > item.quantity) {
            console.warn("Nice try! It's a gift order u cant encrease it's amount!");
            return;
        }

        setCartItems(prev =>
            prev.map((it: CartItem) => (it === item ? {...it, quantity: newQty} : it))
        );
    }

    function handleChangeSize(item: CartItem, newSize: string): void {
        const sameItems = getSameItems(item.name)
        const matched = sameItems ? sameItems.find((it: MenuItem) => it.size === newSize) : null;
        const typedItem = item as CartItem & { sizes?: Record<string, number>; price?: number; id?: number };
        const newBasePrice = matched ? matched.price : (typedItem.sizes?.[newSize] || typedItem.price || 0);
        const newId = matched ? matched.id : typedItem.id;
        setCartItems(prev =>
            prev.map((it: CartItem) => (it === item ? {...it, id: newId, amount: newBasePrice, size: newSize} : it))
        );
    }

    const handleCloseAdminOrderDetailsPopup = (): void => {
        setAdminOrderDetailsPopUpOpen(false);
    }


    const buildOrderTO = (
        orderToEdit: Record<string, unknown>,
        tel: string,
        customer_name: string | null,
        delivery_method: string | null,
        payment_type: string | null,
        items: CartItem[],
        notes: string
    ): unknown => {
        return {
            id: orderToEdit['id'],
            order_no: orderToEdit['order_no'],
            tel,
            customer_name: customer_name,
            delivery_method: delivery_method,
            payment_type: payment_type,
            address: orderToEdit['address'],
            notes: notes,
            items: items.map((item: CartItem) => {
                const typedItem = item as CartItem & { id?: number };
                return {
                    id: typedItem.id,
                    name: item.name,
                    quantity: item.quantity,
                    amount: item.amount,
                    size: item.size || "",
                    category: item.category,
                    description: item.description || "",
                    isGarlicCrust: item.isGarlicCrust,
                    isThinDough: item.isThinDough,
                    discountAmount: item.discountAmount,
                    comboItems: item.comboItems.map((ci) => ({
                        id: (ci as ComboItem & { id?: number }).id,
                        name: ci.name,
                        category: ci.category,
                        size: ci.size || "",
                        quantity: ci.quantity || 1,
                        isGarlicCrust: ci.isGarlicCrust,
                        isThinDough: ci.isThinDough,
                        description: ci.description || ""
                    }))
                };
            }),
            amount_paid: parseFloat(
                items.reduce((acc, item) => {
                    const discountedPrice = item.amount * (1 - item.discountAmount / 100);
                    return acc + discountedPrice * item.quantity;
                }, 0).toFixed(3)
            )
        }
    };

    async function handleCheckout(
        items: CartItem[],
        tel: string,
        customerName: string | null,
        deliveryMethod: string | null,
        paymentMethod: string | null,
        notes: string,
        branchId?: string | null,
    ): Promise<void> {
        if (!wasCrossSellShown && !isAdmin) {
            setIsCrossSellOpen(true);
            setWasCrossSellShown(true);
            return;
        }
        if (paymentMethod === null) {
            setCartOpen(false);
            if (isAdmin) {
                setAdminOrderDetailsPopUpOpen(true);
            } else setPhonePopupOpen(true);
        } else if (isAdmin && isEditMode) {
            setLoading(true);
            try {
                const orderToEdit = JSON.parse(localStorage.getItem("orderToEdit") ?? "{}") as Record<string, unknown>;
                const order = buildOrderTO(orderToEdit, tel, customerName, deliveryMethod, paymentMethod, items, notes);
                const res = await editOrder(order as EditOrderRequest, String(orderToEdit['id']));
                const EDITED_ORDER_ID_KEY = 'editedOrderId';
                const list = [String(res.id)];
                localStorage.setItem(EDITED_ORDER_ID_KEY, JSON.stringify(list));
                setCartOpen(false);
                navigate("/admin/");
            } catch (error) {
                console.error(error);
            } finally {
                await localStorage.removeItem("orderToEdit")
                setLoading(false);
            }
        } else {
            const order = {
                tel,
                customer_name: customerName,
                type: "Pick Up",
                payment_type: paymentMethod,
                branchId: isKiosk? JSON.parse(localStorage.getItem(BRANCH_KEY) || '{}').id : isAdmin? adminBranchId : branchId,
                notes: notes,
                items: items.map((item: CartItem) => {
                    const typedItem = item as CartItem & { id?: number };
                    return {
                        id: typedItem.id,
                        name: item.name,
                        quantity: item.quantity,
                        amount: parseFloat(String(item.amount)),
                        size: item.size || "",
                        category: item.category,
                        description: item.description || "",
                        isGarlicCrust: item.isGarlicCrust,
                        isThinDough: item.isThinDough,
                        discountAmount: item.discountAmount,
                        comboItems: (item.comboItems || []).map((ci) => ({
                            id: (ci as ComboItem & { id?: number }).id,
                            name: ci.name,
                            category: ci.category,
                            size: ci.size || "",
                            quantity: ci.quantity || 1,
                            isGarlicCrust: ci.isGarlicCrust,
                            isThinDough: ci.isThinDough,
                            description: ci.description || ""
                        }))
                    };
                }),
                amount_paid: parseFloat(
                    items.reduce((acc, item) => {
                        const discountedPrice = item.amount * (1 - (item.discountAmount || 0) / 100);
                        return acc + discountedPrice * item.quantity;
                    }, 0).toFixed(3)
                ),
            };
            setCartItems([]);

            try {
                let response;

                if (isAdmin) {
                    setLoading(true);
                    setCartItems([]);
                    isAdminConfirmedRef.current = false;
                    response = await createOrder(order)
                    const SUPPRESS_KEY = 'suppressSoundIds';
                    const createdId = String(response.id);
                    console.log("Received id " + createdId);
                    if (createdId != null) {
                        try {
                            const list = [createdId];

                            localStorage.setItem(SUPPRESS_KEY, JSON.stringify(list));
                            console.log("LocalStorage updated with new suppressed ID: " + createdId);
                        } catch (e) {
                        }
                    }
                    setLoading(false);
                    navigate("/admin/");
                    // ttq.identify is accessed via index signature since it's under [key: string]: unknown
                    (window.ttq as Record<string, unknown> & { identify?: (data: Record<string, unknown>) => void })?.identify?.({
                        phone_number: "+" + tel
                    });
                }
                else if (isKiosk) {
                    setLoading(true);
                    setCartItems([]);
                    response = await createOrder(order)
                    const SUPPRESS_KEY = 'suppressSoundIds';
                    const createdId = String(response.id);
                    console.log("Received id " + createdId);
                    if (createdId != null) {
                        try {
                            const list = [createdId];

                            localStorage.setItem(SUPPRESS_KEY, JSON.stringify(list));
                            console.log("LocalStorage updated with new suppressed ID: " + createdId);
                        } catch (e) {
                        }
                    }
                    setLoading(false)
                }
                else {
                    let blacklist = await getAllBannedCstmrs()
                    if(isCustomerBanned(blacklist, order.tel)){
                        setBlacklistSnackBarOpen(true);
                        return
                    }
                    let customerResponse = await checkCustomer(order.tel)
                    console.log((customerResponse as Record<string, unknown>)?.['isNewCustomer'])
                    if ((customerResponse as Record<string, unknown>)?.['isNewCustomer'] === false) {
                        await executeOrderCreation(order)
                    } else {
                        setPendingOrder(order)
                        setPickUpReminder(true)
                    }
                }
                console.log("Order placed successfully:", response);
            } catch (error) {
                setErrorMessage((error as Error).message);
                setErrorSnackBarOpen(true)
                console.error("Error placing order:", error);
            } finally {
                await localStorage.removeItem("orderToEdit")
                setPhone("")
                setUsername("")
                setCartOpen(false);
                setCartItems([]);
            }
        }
    }


    const executeOrderCreation = async (orderData: unknown): Promise<void> => {
        try {
            setLoading(true);

            const response = await createOrder(orderData as CreateOrderRequest);

            const typedOrder = orderData as { amount_paid: number; tel: string; items: Array<{ id?: number; name: string; quantity: number; amount: number }> };
            window.ttq?.track('PlaceAnOrder', {
                content_id: "PlaceAnOrder",
                order_id: response.id,
                currency: 'BHD',
                value: typedOrder.amount_paid,
            });
            // ttq.identify is accessed via index signature since it's under [key: string]: unknown
            (window.ttq as Record<string, unknown> & { identify?: (data: Record<string, unknown>) => void })?.identify?.({phone_number: "+" + typedOrder.tel});

            setCartItems([]);
            setPendingOrder(null)
            setPickUpReminder(false);
            await localStorage.removeItem("orderToEdit");
            setPhone("");
            setUsername("");
            setCartOpen(false);

            if (!isKiosk) {
                navigate("/order_status?order_id=" + response.id);
            }

        } catch (error) {
            setErrorMessage((error as Error).message);
            setErrorSnackBarOpen(true)
            console.error("Error processing order:", error);
        } finally {
            setLoading(false);
        }
    };

    function handleUpsellDecline(): void {
        if (upsellItem) {
            handleAddToCart(pendingItems as CartItem[], true);
        }
        setUpsellPopupOpen(false);
        setComboOfferPhoto(null);
        setComboPrice(null);
        setUpsellItem(null);
        setUpsellType(null);
    }

    function handleUpsellAccept(item: CartItem | null, type: string | null): void {
        if (type === "pizza") {
            const pizzaCombos = menuData.filter((m: MenuItem) => m.name === "Pizza Combo");
            if (pizzaCombos.length > 0) {
                setPopupGroup(pizzaCombos);
                setPizzaComboPopupOpen(true);
            }
        } else if (type === "brick") {
            const detroitCombo = menuData.filter((m: MenuItem) => m.name === "Detroit Combo");
            if (detroitCombo) {
                setPopupGroup(detroitCombo);
                setDetroitComboPopupOpen(true);
            }
        }
        setComboOfferPhoto(null);
        setComboPrice(null);
        setUpsellPopupOpen(false);
    }

    return (
        <Box sx={{backgroundColor: "#fbfaf6"}}>
            {!isAdmin && (
                <Box
                    sx={{
                        position: "relative",
                        width: "100%",
                        height: {xs: "70vh", sm: "70vh", md: "70vh"},
                        overflow: "hidden",
                        backgroundColor: "#fbfaf6",
                        mb: 0,
                    }}
                >
                    <Box
                        component="video"
                        src={isKiosk ? "/videos/header_vid_2.mp4" : "/videos/header-vid.mp4"}
                        autoPlay
                        muted
                        loop
                        playsInline
                        preload="auto"
                        poster="/images/header_poster.jpg"
                        aria-hidden="true"
                        disablePictureInPicture
                        sx={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            zIndex: 0,
                            pointerEvents: "none",
                        }}
                    />
                    <Box
                        sx={{
                            position: "absolute",
                            bottom: 0,
                            width: "100%",
                            height: "40%",
                            background: "#fbfaf6",
                            maskImage: "linear-gradient(to top, rgba(0,0,0,1), rgba(0,0,0,0))",
                            WebkitMaskImage: "linear-gradient(to top, rgba(0,0,0,1), rgba(0,0,0,0))",
                            pointerEvents: "none",
                            zIndex: 1
                        }}
                    />
                    <Box
                        sx={{
                            position: "absolute",
                            bottom: 18,
                            left: 0,
                            width: "100%",
                            zIndex: 2,
                            display: "flex",
                            justifyContent: "center",
                            pointerEvents: "none",
                        }}
                    >
                        <TextTitle>BETTER THAN YOU THINK</TextTitle>
                    </Box>
                    <Box
                        sx={{
                            position: "absolute",
                            top: 16,
                            right: 16,
                            zIndex: 2,
                            display: "flex",
                            gap: 1
                        }}
                    >
                        <Fab
                            size="medium"
                            onClick={() => window.open("https://url-eu.mykeeta.com/4creMhXz", "_blank")}
                            sx={{
                                p: 0,
                                minHeight: "unset",
                                minWidth: "unset",
                                width: 40,
                                height: 40,
                                borderRadius: "50%",
                                boxShadow: "none",

                            }}
                        >
                            <Box
                                component="img"
                                src="/keeta-logo.png"
                                alt="Jahez"
                                sx={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "contain",
                                    borderRadius: "50%",
                                    display: "block",
                                    padding: "3px"
                                }}
                            />
                        </Fab>
                    </Box>
                </Box>
            )}
            <Box sx={{pt: 1.3, pb: 12}}>
                {[
                    {title: "Ramadan Offers", items: ramadan},
                    {title: "Bestsellers", items: bestsellers, isBestSellerBlock: true},
                    {title: "Baguette Pizzas", items: pizzaBaguettes},
                    {title: "Detroit Brick Pizzas", items: brickPizzas},
                    {title: "Combo Deals", items: combos},
                    {title: "Pizzas", items: pizzas},
                    {title: "Sides", items: sides},
                    {title: "Sauces", items: sauces},
                    {title: "Beverages", items: beverages},
                ]
                    .filter(({items}) => items.length > 0)
                    .map((section, idx, arr) => {
                        const isLast = idx === arr.length - 1;
                        const isBest = section.title === "Bestsellers";


                        return (
                            <Box key={section.title} sx={{pb: isLast ? 1 : 4}}>
                                <TextGroup sx={{px: 1.5, pb: 1}}>{section.title}</TextGroup>

                                <Box
                                    ref={isBest ? bestRef : null}
                                    sx={{
                                        display: "flex",
                                        overflowX: "auto",
                                        px: 1,
                                        scrollSnapType: "x mandatory",
                                        scrollBehavior: "auto",
                                        "&::-webkit-scrollbar": {display: "none"},
                                        WebkitOverflowScrolling: "touch",
                                    }}
                                >
                                    {section.items.map((group: Group) => (
                                        <Box
                                            key={group.name}
                                            sx={{flex: "0 0 auto", scrollSnapAlign: "start", mb: 0.5}}>
                                            <MenuItemCardHorizontal
                                                // Runtime Group always carries `category` from menu_service; cast to satisfy MenuItemCardHorizontal
                                                group={group as import('./components/MenuItemCardHorizontal').GroupWithCategory}
                                                onSelect={handleOpenPopup}
                                                isBestSellerBlock={section.isBestSellerBlock}
                                                handleRemoveItemFromCart={handleRemoveItemFromCart}
                                                handleAddToCart={handleAddToCart}
                                                handleChangeQuantity={handleChangeQuantity}
                                                cartItems={cartItems}
                                            />
                                        </Box>
                                    ))}
                                </Box>
                            </Box>
                        );
                    })}
            </Box>

            {!pizzaPopupOpen &&
                !comboPopupOpen &&
                !genericPopupOpen &&
                !cartOpen &&
                !phonePopupOpen &&
                !adminOrderDetailsPopUp &&
                isAdmin &&
                !pizzaComboPopupOpen &&
                !detroitComboPopupOpen &&
                !upsellPopupOpen &&
                !ramadanPopupOpen &&
                ! ramadanInfoPopupOpen && (
                    <Box sx={{
                        position: 'fixed',
                        top: 16,
                        right: 16,
                        zIndex: 10000
                    }}
                    >
                        <IconButton
                            onClick={() => {
                                setCartItems([]);
                                navigate('/admin/');
                            }}
                            sx={{
                                backgroundColor: "#ffffff",
                                boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                                "&:hover": {
                                    backgroundColor: "#f5f5f5"
                                }
                            }}
                        >
                            <CloseIcon sx={{fontSize: 28, color: "#E44B4C"}}/>
                        </IconButton>
                    </Box>
                )}

            {pizzaPopupOpen && <PizzaPopup
                open={pizzaPopupOpen}
                group={popupGroup as Group}
                extraIngredients={extraIngredients}
                toppings={toppings}
                editItem={editItem}
                onClose={handleClosePizzaPopup}
                onAddToCart={handleAddToCart}
                crossSellItems={getGeneralCrossSellItems()}
                removeFromCart={removeFromCart}
                isEditMode={editMode}
                isSDoughAvailable={isSDoughAvailable}
                isMDoughAvailable={isMDoughAvailable}
            />
            }

            {comboPopupOpen && <ComboPopup
                open={comboPopupOpen}
                group={popupGroup as Group}
                uniquePizzas={pizzas}
                onClose={() => handleCloseComboPopup}
                onAddToCart={handleAddToCart}
            />
            }

            {branchSelector && <KioskBranchSelector
                open={!!branchSelector}
                branches={availableBranches}
                onSelect={(branch: IBranch) => {
                    console.log(branch ," Saved in local Storage");
                    localStorage.setItem(BRANCH_KEY, JSON.stringify(branch))
                    setBranchSelector(false)
                }}
            />
            }

            {pizzaComboPopupOpen && (
                <PizzaComboPopup
                    open={true}
                    onClose={handleClosePizzaComboPopup}
                    comboGroup={popupGroup as MenuItem[]}
                    pizzas={pizzas}
                    drinks={beverages}
                    sauces={sauces}
                    onAddToCart={handleAddToCart}
                    selectedPizza={upsellItem}
                    editItem={editItem}
                    isEditMode={editMode}
                    removeFromCart={removeFromCart}
                    isSDoughAvailable={isSDoughAvailable}
                    isMDoughAvailable={isMDoughAvailable}
                />
            )}

            {ramadanPopupOpen && (
                <RamadanPopup open={ramadanPopupOpen}
                              onClose={() => {
                                  setRamadanPopupOpen(false)
                                  setRamadanInfoPopupOpen(true)
                              }}
                              onAddToCart={handleAddToCart} group={ramadan[0]}/>
            )}

            {detroitComboPopupOpen && (
                <DetroitComboPopup
                    open={true}
                    onClose={handleCloseDetroitComboPopup}
                    combo={popupGroup as Group | MenuItem[]}
                    bricks={brickPizzas}
                    drinks={beverages}
                    sauces={sauces}
                    onAddToCart={handleAddToCart}
                    selectedDetroitPizza={upsellItem}
                    editItem={editItem}
                    isEditMode={editMode}
                    removeFromCart={removeFromCart}
                />
            )}

            {upsellPopupOpen && (
                <UpsellPopup
                    open={true}
                    onClose={() => setUpsellPopupOpen(false)}
                    upsellItem={upsellItem}
                    upsellType={upsellType ?? ""}
                    onAccept={handleUpsellAccept}
                    onDecline={handleUpsellDecline}
                    photo={comboOfferPhoto ?? undefined}
                    comboPrice={comboPrice ?? 0}
                />
            )}

            {blacklistSnackBarOpen && (
                <BlackListSnackBar
                    open={blacklistSnackBarOpen}
                    onClose={()=> setBlacklistSnackBarOpen(false)}
                ></BlackListSnackBar>
            )}

            {unavailablePopupOpen && (
                <UnavailablePopup
                    open={unavailablePopupOpen}
                    onClose={() => setUnavailablePopupOpen(false)}
                    unavailableItems={unavailableItems}/>
            )}

            {genericPopupOpen && <GenericItemPopupContent
                open={genericPopupOpen}
                group={popupGroup as Group}
                onClose={handleCloseGenericPopup}
                onAddToCart={handleAddToCart}
                crossSellItems={getGeneralCrossSellItems()}
                extraIngredients={extraIngredients}
            />
            }

            {ramadanInfoPopupOpen &&
                <RamadanInfoPopup
                    open={ramadanInfoPopupOpen}
                    onClose={() => setRamadanInfoPopupOpen(false)}/>
            }

            {isCrossSellOpen && <CrossSellPopup
                open={isCrossSellOpen}
                crossSellItems={getFinalCrossSell()}
                onClose={() => setIsCrossSellOpen(false)}
                onAddToCart={handleAddToCart}
                onCheckout={() => {
                    // CrossSellPopup calls onCheckout with no args; handleCheckout uses wasCrossSellShown flag
                    handleCheckout(cartItems, phone, null, null, null, "", null);
                }}
            />
            }

            {baguettePizzaPopupOpen && <BaguettePizzaPopup
                open={baguettePizzaPopupOpen}
                onClose={() => {
                    setPopupGroup(null);
                    setBaguettePizzaPopupOpen(false)
                }}
                onAddToCart={handleAddToCart}
                crossSellItems={getFinalCrossSell()}
                removeFromCart={removeFromCart}
                menuItem={(popupGroup as Group).items[0]}
            />
            }

            {cartOpen && <CartComponent
                open={cartOpen}
                items={cartItems}
                onClose={handleCloseCart}
                onChangeQuantity={handleChangeQuantity}
                onChangeSize={handleChangeSize}
                onRemoveItem={handleRemoveItemFromCart}
                onCheckout={handleCheckout}
                openPizzaEditPopUp={openPizzaEditPopUp}
                openPizzaComboEditPopup={openPizzaComboEditPopup}
                openDetroitComboEditPopup={openDetroitComboEditPopup}
                isAdmin={isAdmin}
                handleDiscountChange={handleDiscountChange}
                menuData={menuData}
            />
            }

            {closedPopup && (
                <ClosedPopup open={closedPopup} onClose={() => setClosedPopupOpen(false)}/>
            )}

            {phonePopupOpen && <ClientInfoPopup
                isPhonePopupOpen={phonePopupOpen}
                // IBranch.id is number but ClientInfoPopup.Branch.id is string; map to string-id shape
                branches={availableBranches.map(b => ({ ...b, id: String(b.id) }))}
                onClose={handleClosePhonePopup}
                onSave={(tel: string, paymentMethod: string, customerName: string, notes: string, branchId: string) => {
                        handleCheckout(cartItems, tel, customerName, "Pick Up", paymentMethod, notes, branchId);
                }}
                phoneNumber={phone.toString()}
                customerName={username}
            />
            }

            {adminOrderDetailsPopUp && <AdminOrderDetailsPopUp
                isAdminOrderDetailsPopUpOpen={adminOrderDetailsPopUp}
                onClose={handleCloseAdminOrderDetailsPopup}
                onSave={(phone: string, customerName: string, deliveryMethod: string, paymentMethod: string, notes: string) => (
                    handleCheckout(cartItems, phone, customerName, deliveryMethod, paymentMethod, notes, adminBranchId)

                )
                }
                cartItems={cartItems}
                setCartItems={setCartItems}
            />}

            {pickUpReminder &&
                <PickUpReminderPopup
                    onClose={() => {
                        setPickUpReminder(false)
                    }}
                    onClick={() => {
                        setPickUpReminder(false)
                        executeOrderCreation(pendingOrder)
                    }
                    }
                />
            }



            {!isAdmin && showOrderConfirmed && (
                <OrderConfirmed open={true} onClose={() => setShowOrderConfirmed(false)}/>
            )}

            {!adminOrderDetailsPopUp && !phonePopupOpen && !cartOpen && !pizzaPopupOpen && !genericPopupOpen && !comboPopupOpen && !closedPopup && !pizzaComboPopupOpen && !detroitComboPopupOpen && !upsellPopupOpen && !ramadanPopupOpen && !unavailablePopupOpen &&cartItems.length > 0 && !baguettePizzaPopupOpen &&
                <Box
                    onClick={handleOpenCart}
                    sx={{
                        position: "fixed",
                        bottom: 24,
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: "70vw",
                        maxWidth: 400,
                        zIndex: 9999,
                        px: 3,
                        py: 2,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        borderRadius: 999,
                        backdropFilter: "blur(8px)",
                        backgroundColor: "rgba(255, 255, 255, 0.7)",
                        boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.1)",
                        cursor: "pointer",
                        transition: "background-color 0.3s",
                        "&:hover": {
                            backgroundColor: "rgba(255, 255, 255, 0.8)",
                        },
                    }}
                >
                    {totalPrice && totalPrice !== "0.00" && <Box sx={{flexGrow: 1, textAlign: "center"}}>
                        <TextButton sx={{fontWeight: 600, color: "#000", fontSize: "1.1rem"}}>
                            {totalPrice} BHD
                        </TextButton>
                    </Box>}

                    <Badge
                        badgeContent={cartItems.length}
                        color="error"
                        sx={{
                            "& .MuiBadge-badge": {
                                fontSize: "12px",
                                height: "22px",
                                minWidth: "22px",
                                backgroundColor: brandRed,
                                color: "white",
                                top: 2,
                                right: 2,
                            },
                        }}
                    >
                        <ShoppingCartIcon sx={{color: brandRed, fontSize: 32}}/>
                    </Badge>
                </Box>
            }

            <ErrorSnackbar
                open={errorSnackBarOpen}
                message={errorMessage}
                severity="error"
                handleClose={() => setErrorSnackBarOpen(false)}
            />
        </Box>
    );
}

export default HomePage;
