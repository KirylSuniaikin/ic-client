import { logger } from "../../../shared/utils/logger";
import { useState, useRef, useEffect, Dispatch, SetStateAction } from "react";
import { NavigateFunction } from "react-router-dom";
import { createOrder, editOrder } from "../../../shared/api/public";
import { getAllBannedCstmrs } from "../../../shared/api/management";
import { fetchCustomerMe } from "../../../shared/api/customerAuth";
import { DEFAULT_BRANCH_ID } from "../../../shared/api/client";
import { resolveFbc, resolveFbp } from "../../../shared/utils/adAttribution";
import { useCustomerAuth } from "../../customer-auth/context/CustomerAuthProvider";
import { useCustomerAuthUi } from "../../customer-auth/context/CustomerAuthUiProvider";
import type { CustomerMeResponse } from "../../customer-auth/types";
import { ItemsUnavailableError, BranchClosedError, DEFAULT_PAYMENT_METHOD } from "../types";
import type { CreateOrderRequest, EditOrderRequest } from "../types";
import type { MenuItem, CartItem } from "../../menu/types";

const BRANCH_KEY = 'kiosk_branch_data';
// TODO: hardcoded cross-sell lists; these should come from the API once a cross-sell endpoint exists
const GENERAL_CROSS_SELL: string[] = ["Hot Honey Sauce", "Ranch Sauce", "Coca Cola Zero"];
const FINAL_CROSS_SELL: string[] = ["BBQ Chicken Ranch Detroit Brick", "Coca Cola Zero", "Ranch Sauce", "Hot Honey Sauce", "Pizza Rolls", "Water"];

interface UseCheckoutParams {
    isAdmin: boolean;
    isKiosk: boolean;
    isEditMode: boolean;
    adminBranchId: string | null;
    menuData: MenuItem[];
    cartItems: CartItem[];
    setCartItems: Dispatch<SetStateAction<CartItem[]>>;
    setCartOpen: Dispatch<SetStateAction<boolean>>;
    refreshMenu: () => Promise<void>;
    navigate: NavigateFunction;
}

export interface UseCheckoutResult {
    checkoutLoading: boolean;
    phonePopupOpen: boolean;
    setPhonePopupOpen: Dispatch<SetStateAction<boolean>>;
    customerPrefill: CustomerMeResponse | null;
    cartNote: string;
    setCartNote: Dispatch<SetStateAction<string>>;
    // Drives the cart's note field: only logged-in customers skip the popup, so only they need
    // to write the note in the cart.
    isCustomerLoggedIn: boolean;
    adminOrderDetailsPopUp: boolean;
    setAdminOrderDetailsPopUpOpen: Dispatch<SetStateAction<boolean>>;
    isCrossSellOpen: boolean;
    setIsCrossSellOpen: Dispatch<SetStateAction<boolean>>;
    pickUpReminder: boolean;
    setPickUpReminder: Dispatch<SetStateAction<boolean>>;
    pendingOrder: CreateOrderRequest | null;
    pendingCartItems: CartItem[];
    unavailableItems: string[];
    setUnavailableItems: Dispatch<SetStateAction<string[]>>;
    unavailableMessage: string | null;
    setUnavailableMessage: Dispatch<SetStateAction<string | null>>;
    unavailablePopupOpen: boolean;
    setUnavailablePopupOpen: Dispatch<SetStateAction<boolean>>;
    blacklistSnackBarOpen: boolean;
    setBlacklistSnackBarOpen: Dispatch<SetStateAction<boolean>>;
    errorSnackBarOpen: boolean;
    setErrorSnackBarOpen: Dispatch<SetStateAction<boolean>>;
    errorMessage: string;
    showOrderConfirmed: boolean;
    setShowOrderConfirmed: Dispatch<SetStateAction<boolean>>;
    generalCrossSellItems: MenuItem[];
    finalCrossSellItems: MenuItem[];
    handleCheckout: (items: CartItem[], tel: string, customerName: string | null, deliveryMethod: string | null, paymentMethod: string | null, notes: string, branchId?: string | null) => Promise<void>;
    executeOrderCreation: (orderData: CreateOrderRequest, originalCartItems: CartItem[]) => Promise<void>;
}

function isCustomerBanned(blackList: Array<{ telephoneNo: string }>, phoneNumber: string): boolean {
    return blackList.some(c => c.telephoneNo === phoneNumber);
}

export function useCheckout(params: UseCheckoutParams): UseCheckoutResult {
    const { isAdmin, isKiosk, isEditMode, adminBranchId, menuData, cartItems, setCartItems, setCartOpen, refreshMenu, navigate } = params;

    const { token } = useCustomerAuth();
    const { openOrderDetail, refreshActiveOrder, openLogin, isLoginOpen } = useCustomerAuthUi();

    const [checkoutLoading, setCheckoutLoading] = useState(false);
    const [phonePopupOpen, setPhonePopupOpen] = useState(false);
    const [customerPrefill, setCustomerPrefill] = useState<CustomerMeResponse | null>(null);
    // The same profile as customerPrefill, readable synchronously by resolveOrderCount.
    const customerProfileRef = useRef<CustomerMeResponse | null>(null);
    // Order note for logged-in customers, who skip ClientInfoPopup (and its note field) and so
    // would otherwise have no way to attach one. Guests still type theirs in the popup.
    const [cartNote, setCartNote] = useState("");
    const [adminOrderDetailsPopUp, setAdminOrderDetailsPopUpOpen] = useState(false);
    const [wasCrossSellShown, setWasCrossSellShown] = useState(false);
    const [isCrossSellOpen, setIsCrossSellOpen] = useState(false);
    const [pickUpReminder, setPickUpReminder] = useState(false);
    const [pendingOrder, setPendingOrder] = useState<CreateOrderRequest | null>(null);
    const [pendingCartItems, setPendingCartItems] = useState<CartItem[]>([]);
    const [unavailableItems, setUnavailableItems] = useState<string[]>([]);
    const [unavailableMessage, setUnavailableMessage] = useState<string | null>(null);
    const [unavailablePopupOpen, setUnavailablePopupOpen] = useState(false);
    const [blacklistSnackBarOpen, setBlacklistSnackBarOpen] = useState(false);
    const [errorSnackBarOpen, setErrorSnackBarOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState('Error occurred placing an order');
    const [showOrderConfirmed, setShowOrderConfirmed] = useState(false);
    // Mandatory-account checkout gate: a guest order build is held here while the OTP
    // sheet verifies their phone. A ref, not state -- the
    // resolution effect below must never read a stale closure of the pending order/items.
    const [awaitingVerification, setAwaitingVerification] = useState(false);
    const verificationRef = useRef<{ order: CreateOrderRequest; items: CartItem[] } | null>(null);
    // Guards against misreading the render before isLoginOpen flips true (in the same
    // commit a successful login opens and closes the sheet) as a dismissal -- see the
    // resolution effect below.
    const seenLoginOpenRef = useRef(false);

    const generalCrossSellItems = GENERAL_CROSS_SELL
        .map(name => menuData.find(item => item.name === name && item.available))
        .filter((item): item is MenuItem => item !== undefined);

    const finalCrossSellItems = FINAL_CROSS_SELL
        .map(name => menuData.find(item => item.name === name && item.available))
        .filter((item): item is MenuItem => item !== undefined);

    function buildOrderTO(orderToEdit: Record<string, unknown>, tel: string, customerName: string | null, deliveryMethod: string | null, paymentType: string | null, items: CartItem[], notes: string): EditOrderRequest {
        return {
            id: orderToEdit['id'] as string, // JSON-parsed from localStorage; 'id' is always a string per EditOrderRequest
            order_no: orderToEdit['order_no'] as number, // JSON-parsed from localStorage; always a number per backend contract
            tel,
            customer_name: customerName,
            delivery_method: deliveryMethod,
            payment_type: paymentType,
            address: orderToEdit['address'],
            notes,
            items: items.map(item => ({
                id: item.id, name: item.name, quantity: item.quantity, amount: item.amount,
                size: item.size || "", category: item.category, description: item.description || "",
                isGarlicCrust: !!item.isGarlicCrust, isThinDough: !!item.isThinDough,
                discountAmount: item.discountAmount ?? 0,
                comboItems: (item.comboItems || []).map(ci => ({
                    id: ci.id, name: ci.name, category: ci.category, size: ci.size || "",
                    quantity: ci.quantity || 1, isGarlicCrust: !!ci.isGarlicCrust,
                    isThinDough: !!ci.isThinDough, description: ci.description || ""
                }))
            })),
            amount_paid: parseFloat(items.reduce((acc, item) => {
                return acc + item.amount * (1 - (item.discountAmount ?? 0) / 100) * item.quantity;
            }, 0).toFixed(3))
        };
    }

    async function executeOrderCreation(orderData: CreateOrderRequest, originalCartItems: CartItem[]): Promise<void> {
        try {
            setCheckoutLoading(true);
            const response = await createOrder(orderData);
            window.ttq?.track('PlaceAnOrder', { content_id: "PlaceAnOrder", order_id: response.id, currency: 'BHD', value: orderData.amount_paid });
            // window.ttq is the TikTok pixel SDK; a global.d.ts augmentation would be cleaner but is not available
            (window.ttq as Record<string, unknown> & { identify?: (data: Record<string, unknown>) => void })?.identify?.({ phone_number: "+" + orderData.tel });
            setCartItems([]);
            setCartNote("");
            setPendingOrder(null);
            setPickUpReminder(false);
            await localStorage.removeItem("orderToEdit");
            setCartOpen(false);
            // executeOrderCreation is reached only by the non-admin, non-kiosk customer
            // path -- admin/kiosk call createOrder directly in their own branches, and
            // finalizeOrder is only invoked once the mandatory-account gate has confirmed
            // token !== null. Logged-in customers land on
            // CustomerProfilePopup + CustomerOrderDetailPopup for the new order instead of
            // the anonymous OrderStatusPage.
            if (!isKiosk) {
                // Seed the homepage island with the just-placed order so the widget
                // is ready underneath and appears the moment the popups close.
                refreshActiveOrder();
                openOrderDetail(Number(response.id));
            }
        } catch (error) {
            if (error instanceof BranchClosedError) {
                // Race: the branch closed between fetching base info and submitting.
                // Apologise and refetch working hours (refreshMenu reloads base-app-info).
                setErrorMessage(error.message);
                setErrorSnackBarOpen(true);
                refreshMenu().catch(() => {});
                return;
            }
            if (error instanceof ItemsUnavailableError) {
                const removed = originalCartItems.filter(item => error.unavailableIds.includes(item.id));
                const remaining = originalCartItems.filter(item => !error.unavailableIds.includes(item.id));
                setCartItems(remaining);
                setCartOpen(remaining.length > 0);
                setUnavailableItems(removed.map(i => i.name));
                setUnavailableMessage(error.message);
                setUnavailablePopupOpen(true);
                refreshMenu().catch(() => {});
                return;
            }
            setErrorMessage(error instanceof Error ? error.message : String(error));
            setErrorSnackBarOpen(true);
            logger.error("Error processing order:", error);
        } finally {
            setCheckoutLoading(false);
        }
    }

    // Live order count for the phone this order is for. GET /customer/me counts the
    // customer's orders directly, so it is preferred over GET /check_customer, which reads
    // the denormalized (drift-prone) Customer.amountOfOrders counter and needs a second
    // round-trip. Reuses the profile checkout already fetched when it belongs to the SAME
    // phone -- a logged-in customer can still type a different number into ClientInfoPopup,
    // and the reminder must reflect the phone the order is actually filed under.
    // null means "unknown" (no session, or the fetch failed); callers treat that as a
    // first-time customer rather than skip a genuine first-timer's pick-up warning.
    async function resolveOrderCount(tel: string | null): Promise<number | null> {
        const cached = customerProfileRef.current;
        if (cached && cached.phone === tel) {
            return cached.amountOfOrders ?? null;
        }
        const me = await fetchProfileForCheckout();
        return me && me.phone === tel ? me.amountOfOrders ?? null : null;
    }

    // Extracted terminal step shared by the logged-in-from-the-start path and the
    // freshly-verified-guest path (completeVerifiedCheckout below) -- a customer who has
    // never completed an order goes through the Pick-Up reminder first; everyone else
    // has their order created straight away.
    async function finalizeOrder(order: CreateOrderRequest, items: CartItem[]): Promise<void> {
        const orderCount = await resolveOrderCount(order.tel ?? null);
        if (orderCount !== null && orderCount > 0) {
            await executeOrderCreation(order, items);
        } else {
            setPendingCartItems(items);
            setPendingOrder(order);
            // The cart must give way to the reminder: it is a Drawer at the same MUI modal
            // z-index and portals in later, so leaving it open buries the reminder behind it
            // and checkout looks like a no-op. Dismissing the reminder reopens the cart.
            setCartOpen(false);
            setPickUpReminder(true);
        }
    }

    // Logged-in customer at the paymentMethod===null checkout gate: fetch the profile so the
    // caller can decide between placing the order straight from the cart and falling back to
    // ClientInfoPopup. A fetch failure (e.g. token expired mid-flow) returns null, which routes
    // to the unfilled popup rather than blocking checkout entirely.
    async function fetchProfileForCheckout(): Promise<CustomerMeResponse | null> {
        if (!token) return null;
        try {
            const me = await fetchCustomerMe(token);
            setCustomerPrefill(me);
            // Mirrored into a ref because the logged-in path re-enters handleCheckout from
            // within the same closure, where the customerPrefill state is still the stale
            // pre-fetch value -- same reason verificationRef exists above.
            customerProfileRef.current = me;
            return me;
        } catch (error) {
            logger.error("Error fetching customer profile for checkout prefill:", error);
            return null;
        }
    }

    // Rebuilds the order against the phone the customer actually verified -- the login
    // sheet lets them go back and change the number on the code step, so the typed and
    // verified phones can diverge; POST /api/create_order links the order to a CRM row
    // purely by string-matching tel, so submitting anything but the verified phone would
    // silently misfile the order.
    async function completeVerifiedCheckout(): Promise<void> {
        const pending = verificationRef.current;
        verificationRef.current = null;
        if (!pending) return;
        const me = await fetchProfileForCheckout();
        const verified: CreateOrderRequest = {
            ...pending.order,
            tel: me?.phone ?? pending.order.tel,
            customer_name: pending.order.customer_name || me?.name || null,
        };
        if (verified.tel !== pending.order.tel) {
            const blacklist = await getAllBannedCstmrs();
            if (isCustomerBanned(blacklist, verified.tel ?? "")) {
                setBlacklistSnackBarOpen(true);
                return;
            }
        }
        await finalizeOrder(verified, pending.items);
    }

    // Routed through a ref so the resolution effect below can call the latest closure
    // without listing completeVerifiedCheckout in its dependency array (its identity
    // changes every render) -- mirrors the loadProfileRef/loadOrdersRef pattern in
    // CustomerProfilePopup.tsx, keeping the effect free of an eslint-disable.
    const completeVerifiedCheckoutRef = useRef(completeVerifiedCheckout);
    completeVerifiedCheckoutRef.current = completeVerifiedCheckout;

    useEffect(() => {
        if (!awaitingVerification) { seenLoginOpenRef.current = false; return; }
        if (token !== null) { setAwaitingVerification(false); void completeVerifiedCheckoutRef.current(); return; }
        if (isLoginOpen) { seenLoginOpenRef.current = true; return; }
        if (seenLoginOpenRef.current) {
            setAwaitingVerification(false);
            verificationRef.current = null;
            setCartOpen(true);
        }
    }, [awaitingVerification, token, isLoginOpen, setCartOpen]);

    function openClientInfoPopup(): void {
        setCartOpen(false);
        setPhonePopupOpen(true);
    }

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
            if (isAdmin) {
                setCartOpen(false);
                setAdminOrderDetailsPopUpOpen(true);
                return;
            }
            if (token) {
                const me = await fetchProfileForCheckout();
                // A logged-in customer whose name we know needs nothing else from the popup:
                // the phone and name come from the profile, payment defaults (every web order
                // is a counter-paid Pick Up), and the note is collected in the cart. Re-enter
                // with a non-null payment method so the order runs through the same blacklist /
                // known-customer path as any other checkout instead of a parallel one.
                if (me?.name) {
                    await handleCheckout(items, me.phone, me.name, "Pick Up", DEFAULT_PAYMENT_METHOD, cartNote, DEFAULT_BRANCH_ID);
                    return;
                }
                // No name on file — a legacy account, or the customer closed the popup before
                // the name step. Ask via ClientInfoPopup rather than send a nameless order to
                // the kitchen.
                openClientInfoPopup();
                return;
            }
            openClientInfoPopup();
            return;
        }
        if (isAdmin && isEditMode) {
            setCheckoutLoading(true);
            try {
                // JSON.parse returns unknown; fields accessed via ['key'] with fallbacks below
                const orderToEdit = JSON.parse(localStorage.getItem("orderToEdit") ?? "{}") as Record<string, unknown>;
                const order = buildOrderTO(orderToEdit, tel, customerName, deliveryMethod, paymentMethod, items, notes);
                const res = await editOrder(order, String(orderToEdit['id']));
                localStorage.setItem('editedOrderId', JSON.stringify([String(res.id)]));
                setCartOpen(false);
                navigate("/admin/");
            } catch (error) {
                logger.error(error);
            } finally {
                await localStorage.removeItem("orderToEdit");
                setCheckoutLoading(false);
            }
            return;
        }
        const order: CreateOrderRequest = {
            tel,
            customer_name: customerName,
            type: "Pick Up",
            payment_type: paymentMethod,
            branchId: isKiosk ? JSON.parse(localStorage.getItem(BRANCH_KEY) || '{}').id : isAdmin ? adminBranchId! : branchId!,
            notes,
            items: items.map(item => ({
                id: item.id, name: item.name, quantity: item.quantity,
                amount: parseFloat(String(item.amount)), size: item.size || "",
                category: item.category, description: item.description || "",
                isGarlicCrust: !!item.isGarlicCrust, isThinDough: !!item.isThinDough,
                discountAmount: item.discountAmount ?? 0,
                comboItems: (item.comboItems || []).map(ci => ({
                    id: ci.id, name: ci.name, category: ci.category, size: ci.size || "",
                    quantity: ci.quantity || 1, isGarlicCrust: !!ci.isGarlicCrust,
                    isThinDough: !!ci.isThinDough, description: ci.description || ""
                }))
            })),
            amount_paid: parseFloat(items.reduce((acc, item) => {
                return acc + item.amount * (1 - (item.discountAmount ?? 0) / 100) * item.quantity;
            }, 0).toFixed(3)),
            fbc: resolveFbc(),
            fbp: resolveFbp(),
        };
        const submittedItems = [...items];

        try {
            if (isAdmin) {
                setCheckoutLoading(true);
                try {
                    const response = await createOrder(order);
                    setCartItems([]);
                    localStorage.setItem('suppressSoundIds', JSON.stringify([String(response.id)]));
                    navigate("/admin/");
                } catch (e) {
                    if (e instanceof ItemsUnavailableError) {
                        const removed = submittedItems.filter(item => e.unavailableIds.includes(item.id));
                        const remaining = submittedItems.filter(item => !e.unavailableIds.includes(item.id));
                        if (remaining.length > 0) { setCartItems(remaining); setCartOpen(true); }
                        else { setCartItems([]); setCartOpen(false); }
                        setUnavailableItems(removed.map(i => i.name));
                        setUnavailableMessage(e.message);
                        setUnavailablePopupOpen(true);
                        refreshMenu().catch(() => {});
                        return;
                    }
                    throw e;
                } finally {
                    setCheckoutLoading(false);
                }
            } else if (isKiosk) {
                setCheckoutLoading(true);
                try {
                    const response = await createOrder(order);
                    setCartItems([]);
                    localStorage.setItem('suppressSoundIds', JSON.stringify([String(response.id)]));
                } catch (e) {
                    if (e instanceof ItemsUnavailableError) {
                        const removed = submittedItems.filter(item => e.unavailableIds.includes(item.id));
                        const remaining = submittedItems.filter(item => !e.unavailableIds.includes(item.id));
                        setCartItems(remaining);
                        setCartOpen(true);
                        setUnavailableItems(removed.map(i => i.name));
                        setUnavailableMessage(e.message);
                        setUnavailablePopupOpen(true);
                        refreshMenu().catch(() => {});
                        return;
                    }
                    throw e;
                } finally {
                    setCheckoutLoading(false);
                }
            } else {
                const blacklist = await getAllBannedCstmrs();
                if (isCustomerBanned(blacklist, order.tel ?? "")) {
                    setBlacklistSnackBarOpen(true);
                    return;
                }
                // Mandatory account: a guest must verify this phone via OTP before the
                // order is created. Hold the order/items in a ref
                // (not state) so the resolution effect above can never read a stale closure.
                if (token === null) {
                    verificationRef.current = { order, items: submittedItems };
                    setPhonePopupOpen(false);
                    setAwaitingVerification(true);
                    openLogin(order.tel ?? "", order.customer_name ?? undefined, true);
                    return;
                }
                await finalizeOrder(order, submittedItems);
            }
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : String(error));
            setErrorSnackBarOpen(true);
            logger.error("Error placing order:", error);
        } finally {
            await localStorage.removeItem("orderToEdit");
        }
    }

    return {
        checkoutLoading, phonePopupOpen, setPhonePopupOpen,
        customerPrefill,
        cartNote, setCartNote,
        isCustomerLoggedIn: token !== null,
        adminOrderDetailsPopUp, setAdminOrderDetailsPopUpOpen,
        isCrossSellOpen, setIsCrossSellOpen,
        pickUpReminder, setPickUpReminder,
        pendingOrder, pendingCartItems,
        unavailableItems, setUnavailableItems,
        unavailableMessage, setUnavailableMessage,
        unavailablePopupOpen, setUnavailablePopupOpen,
        blacklistSnackBarOpen, setBlacklistSnackBarOpen,
        errorSnackBarOpen, setErrorSnackBarOpen, errorMessage,
        showOrderConfirmed, setShowOrderConfirmed,
        generalCrossSellItems, finalCrossSellItems,
        handleCheckout, executeOrderCreation,
    };
}
