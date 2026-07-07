import { logger } from "../../../shared/utils/logger";
import { useState, useRef, Dispatch, SetStateAction } from "react";
import { NavigateFunction } from "react-router-dom";
import { checkCustomer, createOrder, editOrder } from "../../../shared/api/public";
import { getAllBannedCstmrs } from "../../../shared/api/management";
import { fetchCustomerMe } from "../../../shared/api/customerAuth";
import { resolveFbc, resolveFbp } from "../../../shared/utils/adAttribution";
import { useCustomerAuth } from "../../customer-auth/context/CustomerAuthProvider";
import { useCustomerAuthUi } from "../../customer-auth/context/CustomerAuthUiProvider";
import type { CustomerMeResponse } from "../../customer-auth/types";
import { ItemsUnavailableError } from "../types";
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
    postOrderProposalOpen: boolean;
    postOrderProposalPhone: string;
    resolvePostOrderProposal: () => void;
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
    const { openOrderDetail, refreshActiveOrder } = useCustomerAuthUi();

    const [checkoutLoading, setCheckoutLoading] = useState(false);
    const [phonePopupOpen, setPhonePopupOpen] = useState(false);
    const [customerPrefill, setCustomerPrefill] = useState<CustomerMeResponse | null>(null);
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
    // Guest post-order account proposal: after a guest's order is created we keep them on
    // the current page to show the proposal (prefilled with this order's phone) and defer
    // the tracking-page redirect until they resolve it. pendingTrackPathRef holds the
    // deferred navigation target; a ref (not state) since it's only read on user action.
    const [postOrderProposalOpen, setPostOrderProposalOpen] = useState(false);
    const [postOrderProposalPhone, setPostOrderProposalPhone] = useState("");
    const pendingTrackPathRef = useRef<string | null>(null);

    function resolvePostOrderProposal(): void {
        setPostOrderProposalOpen(false);
        const path = pendingTrackPathRef.current;
        pendingTrackPathRef.current = null;
        if (path) navigate(path);
    }

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
            setPendingOrder(null);
            setPickUpReminder(false);
            await localStorage.removeItem("orderToEdit");
            setCartOpen(false);
            if (!isKiosk) {
                // Logged-in customers land on CustomerProfilePopup + CustomerOrderDetailPopup
                // for the new order instead of the anonymous OrderStatusPage (task-spec.md
                // §4.15) — admin/kiosk checkout flows never reach this branch (they don't call
                // executeOrderCreation), so a truthy token here always reflects a genuine
                // customer session.
                if (token) {
                    // Seed the homepage island with the just-placed order so the widget
                    // is ready underneath and appears the moment the popups close.
                    refreshActiveOrder();
                    openOrderDetail(Number(response.id));
                    return;
                }
                const path = "/order_status?order_id=" + response.id;
                // Guest post-order account proposal: a guest who submitted a phone stays on
                // the current page to see the proposal first (prefilled with this order's
                // phone); navigation to the tracking page is deferred until they decline or
                // finish creating an account (resolvePostOrderProposal). Phone-less guest
                // orders navigate immediately, as before.
                if (orderData.tel) {
                    pendingTrackPathRef.current = path;
                    setPostOrderProposalPhone(orderData.tel);
                    setPostOrderProposalOpen(true);
                } else {
                    navigate(path);
                }
            }
        } catch (error) {
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

    // Logged-in customer at the paymentMethod===null checkout gate (§6.7 step 1): fetch the
    // profile and open ClientInfoPopup pre-filled. A fetch failure (e.g. token expired mid-flow)
    // falls back to the unfilled popup instead of blocking checkout entirely.
    async function openClientInfoForLoggedInCustomer(): Promise<void> {
        if (token) {
            try {
                const me = await fetchCustomerMe(token);
                setCustomerPrefill(me);
            } catch (error) {
                logger.error("Error fetching customer profile for checkout prefill:", error);
            }
        }
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
            setCartOpen(false);
            if (isAdmin) {
                setAdminOrderDetailsPopUpOpen(true);
            } else if (token) {
                await openClientInfoForLoggedInCustomer();
            } else {
                setPhonePopupOpen(true);
            }
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
                const customerResponse = await checkCustomer(order.tel ?? "");
                if (customerResponse?.isNewCustomer === false) {
                    await executeOrderCreation(order, submittedItems);
                } else {
                    setPendingCartItems(submittedItems);
                    setPendingOrder(order);
                    setPickUpReminder(true);
                }
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
        postOrderProposalOpen, postOrderProposalPhone, resolvePostOrderProposal,
        generalCrossSellItems, finalCrossSellItems,
        handleCheckout, executeOrderCreation,
    };
}
