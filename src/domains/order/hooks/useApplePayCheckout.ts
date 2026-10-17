import { useEffect, useRef, useState, Dispatch, SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { logger } from "../../../shared/utils/logger";
import {
    createApplePayOrder,
    fetchApplePayEligibility,
    fetchApplePayPaymentStatus,
    payApplePayOrder,
    requestApplePayMerchantSession,
} from "../../../shared/api/customerAuth";
import { useBranchResolution } from "../../branch/hooks/useBranchResolution";
import { resolveFbc, resolveFbp } from "../../../shared/utils/adAttribution";
import { resolveCustomerLanguage } from "../../../shared/utils/customerLanguage";
import { useCustomerAuth } from "../../customer-auth/context/CustomerAuthProvider";
import { useCustomerAuthUi } from "../../customer-auth/context/CustomerAuthUiProvider";
import type { CustomerMeResponse } from "../../customer-auth/types";
import type { CartItem } from "../../menu/types";
import { DEFAULT_PAYMENT_METHOD } from "../types";
import type { CreateOrderRequest } from "../types";
import { ApplePayApiError } from "../applePayTypes";
import type { ApplePayPaymentResponse } from "../applePayTypes";
import { buildOrderItems } from "../utils/orderPayload";
import {
    APPLE_PAY_VERSION,
    buildApplePayRequest,
    computeSheetTotal,
    trackApplePayPurchase,
} from "../utils/applePayRequest";
import { newIdempotencyKey } from "../../../shared/utils/idempotencyKey";
import { useCheckoutPrefetch } from "./useCheckoutPrefetch";
import { useApplePayCapability } from "./useApplePayCapability";
import { describeError, isDefinitivePayRejection, pollUntilResolved, reportCreateOrderFailure } from "../utils/checkoutFlow";
import type { Prefetch } from "./useCheckoutPrefetch";
const IN_PROGRESS_CODE = "APPLE_PAY_PAYMENT_IN_PROGRESS";
// Only these pay-stage rejections prove no charge happened; every other pay failure (5xx, proxy
// errors, unknown/missing token, transport errors) is ambiguous and must be resolved by polling.
const DEFINITIVE_PAY_REJECTIONS: ReadonlySet<string> = new Set([
    "APPLE_PAY_INVALID_REQUEST",
    "APPLE_PAY_NOT_AVAILABLE",
    "APPLE_PAY_ORDER_NOT_PAYABLE",
    "APPLE_PAY_INVALID_AMOUNT",
]);

interface UseApplePayCheckoutParams {
    isAdmin: boolean;
    isKiosk: boolean;
    cartOpen: boolean;
    cartItems: CartItem[];
    // Passed through to the order as-is; this hook never branches on it (order-type-agnostic).
    orderType: string;
    setCartItems: Dispatch<SetStateAction<CartItem[]>>;
    setCartOpen: Dispatch<SetStateAction<boolean>>;
    setPaymentMethod: Dispatch<SetStateAction<string>>;
    setOrderType: Dispatch<SetStateAction<string>>;
    refreshMenu: () => Promise<void>;
    setUnavailableItems: Dispatch<SetStateAction<string[]>>;
    setUnavailableMessage: Dispatch<SetStateAction<string | null>>;
    setUnavailablePopupOpen: Dispatch<SetStateAction<boolean>>;
}

export interface UseApplePayCheckoutResult {
    available: boolean;
    busy: boolean;
    start: () => void;
    reminderOpen: boolean;
    continueFromReminder: () => void;
    dismissReminder: () => void;
    error: string | null;
    clearError: () => void;
    // The "confirming"/"needs review" message: persistent while the button stays blocked, kept
    // apart from transient errors so an error snackbar can never clear it.
    notice: string | null;
}

// Everything start() reads. Refreshed on every render so the synchronous gesture handler never
// closes over stale state.
type Latest = {
    token: string | null;
    items: CartItem[];
    orderType: string;
    branchId: string;
    prefetch: Prefetch | null;
    isAdmin: boolean;
    isKiosk: boolean;
};

function isFirstTimeCustomer(profile: CustomerMeResponse): boolean {
    return !profile.amountOfOrders;
}

export function useApplePayCheckout(params: UseApplePayCheckoutParams): UseApplePayCheckoutResult {
    const {
        isAdmin, isKiosk, cartOpen, cartItems, orderType,
        setCartItems, setCartOpen, setPaymentMethod, setOrderType, refreshMenu,
        setUnavailableItems, setUnavailableMessage, setUnavailablePopupOpen,
    } = params;

    const { token } = useCustomerAuth();
    // The order is filed at the pickup branch the customer chose, as useCheckout does; the
    // DEFAULT_BRANCH_ID fallback lives in the resolver.
    const { chosenBranchId } = useBranchResolution();
    const { openOrderDetail, refreshActiveOrder } = useCustomerAuthUi();
    const { t, i18n } = useTranslation("applePay");

    const capable = useApplePayCapability(cartOpen && !isAdmin && !isKiosk);
    const prefetch = useCheckoutPrefetch({
        active: cartOpen && !isAdmin && !isKiosk && capable,
        token,
        fetchEligibility: fetchApplePayEligibility,
        failureLabel: "Apple Pay prefetch failed:",
    });
    const [busy, setBusy] = useState(false);
    const [reminderOpen, setReminderOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    // Synchronous re-entry guard: a double tap or a tap during an active/pending session must
    // not create a second session or order. Stays set while a payment is PENDING.
    const busyRef = useRef(false);
    const mountedRef = useRef(true);
    const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const latest = useRef<Latest>({ token, items: cartItems, orderType, branchId: chosenBranchId, prefetch, isAdmin, isKiosk });
    latest.current = { token, items: cartItems, orderType, branchId: chosenBranchId, prefetch, isAdmin, isKiosk };
    // Same trick for the translator and the cart/menu callbacks used from async session handlers.
    const handlers = useRef({ t, language: i18n.language, setCartItems, setCartOpen, setPaymentMethod, setOrderType, refreshMenu, setUnavailableItems, setUnavailableMessage, setUnavailablePopupOpen, openOrderDetail, refreshActiveOrder });
    handlers.current = { t, language: i18n.language, setCartItems, setCartOpen, setPaymentMethod, setOrderType, refreshMenu, setUnavailableItems, setUnavailableMessage, setUnavailablePopupOpen, openOrderDetail, refreshActiveOrder };

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
        };
    }, []);

    const available =
        !isAdmin && !isKiosk && token !== null && cartItems.length > 0 &&
        prefetch !== null && prefetch.eligible && !prefetch.banned && !!prefetch.profile.name &&
        capable;

    function release(): void {
        busyRef.current = false;
        if (mountedRef.current) setBusy(false);
    }

    function report(message: string): void {
        if (mountedRef.current) setError(message);
    }

    function showNotice(message: string): void {
        if (mountedRef.current) setNotice(message);
    }

    function clearNotice(): void {
        if (mountedRef.current) setNotice(null);
    }

    function completeSuccess(orderId: number, amount: number, tel: string): void {
        const h = handlers.current;
        clearNotice();
        trackApplePayPurchase(orderId, amount, tel);
        h.setCartItems([]);
        h.setPaymentMethod(DEFAULT_PAYMENT_METHOD);
        h.setOrderType("Pick Up");
        h.setCartOpen(false);
        h.refreshActiveOrder();
        h.openOrderDetail(orderId);
        release();
    }

    function handleResolved(result: ApplePayPaymentResponse, amount: number, tel: string): void {
        if (result.status === "APPROVED") {
            completeSuccess(result.orderId, amount, tel);
        } else if (result.status === "DECLINED") {
            clearNotice();
            report(handlers.current.t("errors.declined"));
            release();
        }
    }

    function pollPayment(orderId: number, amount: number, tel: string): void {
        pollUntilResolved({
            getToken: () => latest.current.token,
            isMounted: () => mountedRef.current,
            onTimer: timer => { pollTimerRef.current = timer; },
            fetchStatus: accessToken => fetchApplePayPaymentStatus(accessToken, orderId),
            failureLabel: "Apple Pay status poll failed:",
            onResolved: result => handleResolved(result, amount, tel),
            onReview: () => showNotice(handlers.current.t("errors.review")),
            onUnresolved: () => showNotice(handlers.current.t("errors.unresolved")),
        });
    }

    function failCreateOrder(failure: unknown, submitted: CartItem[]): void {
        reportCreateOrderFailure(
            failure, submitted, handlers.current, report,
            f => f instanceof ApplePayApiError && f.code === IN_PROGRESS_CODE,
        );
    }

    async function authorize(
        session: ApplePaySessionInstance,
        event: ApplePayPaymentAuthorizedEvent,
        snapshot: { items: CartItem[]; orderType: string; branchId: string; profile: CustomerMeResponse; amount: number; sheetAmount: string },
    ): Promise<void> {
        const { items, profile, amount, sheetAmount } = snapshot;
        const tel = profile.phone;
        let createdOrderId: number | null = null;
        try {
            const accessToken = latest.current.token;
            if (!accessToken) throw new ApplePayApiError("NO_TOKEN", 401);
            const order: CreateOrderRequest = {
                tel,
                customer_name: profile.name,
                type: snapshot.orderType,
                payment_type: "Card",
                branchId: snapshot.branchId,
                notes: "",
                items: buildOrderItems(items),
                amount_paid: amount,
                fbc: resolveFbc(),
                fbp: resolveFbp(),
                language: resolveCustomerLanguage(handlers.current.language, true),
                idempotency_key: newIdempotencyKey(),
            };
            const created = await createApplePayOrder(accessToken, order);
            createdOrderId = created.orderId;
            if (created.amount !== sheetAmount) {
                logger.error("Apple Pay amount mismatch for order", created.orderId);
                session.completePayment(window.ApplePaySession?.STATUS_FAILURE ?? 1);
                report(handlers.current.t("errors.generic"));
                release();
                return;
            }
            const result = await payApplePayOrder(accessToken, created.orderId, {
                attemptKey: newIdempotencyKey(),
                paymentToken: JSON.stringify(event.payment.token.paymentData),
                fbc: resolveFbc() ?? null,
                fbp: resolveFbp() ?? null,
            });
            if (result.status === "APPROVED") {
                session.completePayment(window.ApplePaySession?.STATUS_SUCCESS ?? 0);
                completeSuccess(result.orderId, amount, tel);
                return;
            }
            session.completePayment(window.ApplePaySession?.STATUS_FAILURE ?? 1);
            if (result.status === "DECLINED") {
                report(handlers.current.t("errors.declined"));
                release();
            } else if (result.status === "REVIEW") {
                showNotice(handlers.current.t("errors.review"));
            } else {
                showNotice(handlers.current.t("pending"));
                pollPayment(result.orderId, amount, tel);
            }
        } catch (failure: unknown) {
            logger.error("Apple Pay authorization failed:", describeError(failure));
            session.completePayment(window.ApplePaySession?.STATUS_FAILURE ?? 1);
            // Any pay-stage failure AFTER the order exists that is not a documented definitive
            // rejection (5xx, transport, unknown token) may still have charged the customer:
            // never unblock on a guess, resolve it through the status endpoint instead.
            if (createdOrderId !== null && !isDefinitivePayRejection(failure, ApplePayApiError, DEFINITIVE_PAY_REJECTIONS)) {
                showNotice(handlers.current.t("pending"));
                pollPayment(createdOrderId, amount, tel);
                return;
            }
            failCreateOrder(failure, items);
            release();
        }
    }

    async function validateMerchant(session: ApplePaySessionInstance,validationUrl: string): Promise<void> {
        try {
            const accessToken = latest.current.token;
            if (!accessToken) throw new ApplePayApiError("NO_TOKEN", 401);
            session.completeMerchantValidation(await requestApplePayMerchantSession(accessToken, validationUrl));
        } catch (failure: unknown) {
            logger.error("Apple Pay merchant validation failed:", describeError(failure));
            session.abort();
            report(handlers.current.t("errors.validationFailed"));
            release();
        }
    }

    // Must stay synchronous end to end: Safari only opens the sheet inside the user gesture,
    // so no await and no state-driven deferral may sit before the constructor / begin().
    function openSession(): void {
        const current = latest.current;
        const SessionClass = window.ApplePaySession;
        const profile = current.prefetch?.profile;
        if (busyRef.current || !SessionClass || !profile) return;
        busyRef.current = true;
        setBusy(true);
        setError(null);
        try {
            const { amount, sheetAmount } = computeSheetTotal(current.items);
            const session = new SessionClass(APPLE_PAY_VERSION, buildApplePayRequest(sheetAmount));
            const snapshot = { items: current.items, orderType: current.orderType, branchId: current.branchId, profile, amount, sheetAmount };
            session.onvalidatemerchant = (event): void => { void validateMerchant(session, event.validationURL); };
            session.onpaymentauthorized = (event): void => { void authorize(session, event, snapshot); };
            session.oncancel = (): void => { release(); };
            session.begin();
        } catch (failure: unknown) {
            logger.error("Apple Pay session could not start:", describeError(failure));
            report(handlers.current.t("errors.sessionFailed"));
            release();
        }
    }

    function start(): void {
        if (busyRef.current) return;
        const prefetched = latest.current.prefetch;
        if (!prefetched) return;
        if (isFirstTimeCustomer(prefetched.profile)) {
            // The reminder's continue button is a fresh gesture that opens the session.
            handlers.current.setCartOpen(false);
            setReminderOpen(true);
            return;
        }
        openSession();
    }

    function continueFromReminder(): void {
        setReminderOpen(false);
        openSession();
    }

    function dismissReminder(): void {
        setReminderOpen(false);
        handlers.current.setCartOpen(true);
    }

    return {
        available, busy, start,
        reminderOpen, continueFromReminder, dismissReminder,
        error, clearError: () => setError(null), notice,
    };
}
