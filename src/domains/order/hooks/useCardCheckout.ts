import { useEffect, useRef, useState, Dispatch, SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { logger } from "../../../shared/utils/logger";
import {
    createCardOrder,
    createCardSession,
    fetchCardEligibility,
    fetchCardPaymentStatus,
    payCardOrder,
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
import { CardPaymentApiError } from "../cardPaymentTypes";
import type { CardDeclineReason, CardPaymentResponse } from "../cardPaymentTypes";
import { buildOrderItems } from "../utils/orderPayload";
import { computeSheetTotal, trackApplePayPurchase } from "../utils/applePayRequest";
import { loadHostedSessionScript } from "../utils/hostedSessionLoader";
import { newIdempotencyKey } from "../../../shared/utils/idempotencyKey";
import { useCheckoutPrefetch } from "./useCheckoutPrefetch";
import { describeError, isDefinitivePayRejection, pollUntilResolved, reportCreateOrderFailure } from "../utils/checkoutFlow";
import type { Prefetch } from "./useCheckoutPrefetch";

const IN_PROGRESS_CODE = "CARD_PAYMENT_IN_PROGRESS";
// Only these pay-stage rejections prove no charge happened; every other pay failure (5xx, proxy
// errors, transport errors) is ambiguous and must be resolved by polling.
const DEFINITIVE_PAY_REJECTIONS: ReadonlySet<string> = new Set([
    "CARD_INVALID_REQUEST",
    "CARD_NOT_AVAILABLE",
    "CARD_ORDER_NOT_PAYABLE",
    "CARD_INVALID_AMOUNT",
]);

// The ids the hosted fields attach to; the drawer renders inputs with exactly these ids.
export const CARD_FIELD_IDS = {
    cardNumber: "card-number",
    expiryMonth: "expiry-month",
    expiryYear: "expiry-year",
    securityCode: "security-code",
} as const;

export type CardCheckoutStep = "idle" | "preparing" | "ready" | "updatingSession" | "paying" | "needsNewSession";
export type CardFieldErrors = Partial<Record<HostedSessionFieldErrorKey, true>>;

const FIELD_ERROR_KEYS: readonly HostedSessionFieldErrorKey[] = [
    "cardNumber", "expiryMonth", "expiryYear", "securityCode", "nameOnCard",
];

const DECLINE_MESSAGE_KEY: Record<CardDeclineReason, string> = {
    DECLINED: "errors.declined",
    AUTHENTICATION_REQUIRED: "errors.authenticationRequired",
    REJECTED: "errors.rejected",
};

interface UseCardCheckoutParams {
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

export interface UseCardCheckoutResult {
    available: boolean;
    /**
     * A guest is shown card locked rather than not at all (owner, 18 Oct 2026), so they learn it
     * exists and that an account is what it takes. False while the session is still restoring,
     * so a signed-in customer never sees it flash locked.
     */
    signInRequired: boolean;
    busy: boolean;
    start: () => void;
    drawerOpen: boolean;
    closeDrawer: () => void;
    step: CardCheckoutStep;
    fieldErrors: CardFieldErrors;
    error: string | null;
    clearError: () => void;
    // The "confirming"/"needs review" message: persistent while the button stays blocked, kept
    // apart from transient errors so an error snackbar can never clear it.
    notice: string | null;
    submit: () => void;
    retryWithNewSession: () => void;
    // Callback ref: MUI portals mount the drawer's children on a second commit, so the hosted
    // fields can only be configured once this node exists in state.
    fieldContainerRef: (node: HTMLElement | null) => void;
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

type PendingOrder = { orderId: number; amount: number; tel: string; items: CartItem[] };

function readFieldErrors(errors: Partial<Record<HostedSessionFieldErrorKey, string>>): CardFieldErrors {
    const flagged: CardFieldErrors = {};
    for (const key of FIELD_ERROR_KEYS) {
        if (key in errors) flagged[key] = true;
    }
    return flagged;
}

export function useCardCheckout(params: UseCardCheckoutParams): UseCardCheckoutResult {
    const {
        isAdmin, isKiosk, cartOpen, cartItems, orderType,
        setCartItems, setCartOpen, setPaymentMethod, setOrderType, refreshMenu,
        setUnavailableItems, setUnavailableMessage, setUnavailablePopupOpen,
    } = params;

    const { token, isAuthLoading } = useCustomerAuth();
    // The order is filed at the pickup branch the customer chose, as useCheckout does; the
    // DEFAULT_BRANCH_ID fallback lives in the resolver.
    const { chosenBranchId } = useBranchResolution();
    const { openOrderDetail, refreshActiveOrder } = useCustomerAuthUi();
    const { t, i18n } = useTranslation("cardPayment");

    const prefetch = useCheckoutPrefetch({
        active: cartOpen && !isAdmin && !isKiosk,
        token,
        fetchEligibility: fetchCardEligibility,
        failureLabel: "Card prefetch failed:",
    });
    const [busy, setBusy] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [step, setStep] = useState<CardCheckoutStep>("idle");
    const [fieldErrors, setFieldErrors] = useState<CardFieldErrors>({});
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [fieldContainer, setFieldContainer] = useState<HTMLElement | null>(null);
    // Only the generation triggers configure; the session id and SDK stay in refs so no
    // session credential ever sits in React state.
    const [configureGeneration, setConfigureGeneration] = useState<number | null>(null);

    // Synchronous re-entry guards: a double tap, a double submit or a tap during a pending
    // payment must not create a second order, session or charge.
    const busyRef = useRef(false);
    const submitRef = useRef(false);
    const stepRef = useRef<CardCheckoutStep>("idle");
    const mountedRef = useRef(true);
    const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Bumped whenever a prepare run is superseded or the drawer closes, so late async results and
    // SDK callbacks from an abandoned run are dropped.
    const generationRef = useRef(0);
    const orderRef = useRef<PendingOrder | null>(null);
    const sessionIdRef = useRef<string | null>(null);
    const sdkRef = useRef<PaymentSessionStatic | null>(null);
    // The key is reused while the cart is unchanged so re-opening the drawer reuses the same
    // order instead of orphaning a new one.
    const orderKeyRef = useRef<{ signature: string; key: string } | null>(null);

    const latest = useRef<Latest>({ token, items: cartItems, orderType, branchId: chosenBranchId, prefetch, isAdmin, isKiosk });
    latest.current = { token, items: cartItems, orderType, branchId: chosenBranchId, prefetch, isAdmin, isKiosk };
    const handlers = useRef({ t, language: i18n.language, setCartItems, setCartOpen, setPaymentMethod, setOrderType, refreshMenu, setUnavailableItems, setUnavailableMessage, setUnavailablePopupOpen, openOrderDetail, refreshActiveOrder });
    handlers.current = { t, language: i18n.language, setCartItems, setCartOpen, setPaymentMethod, setOrderType, refreshMenu, setUnavailableItems, setUnavailableMessage, setUnavailablePopupOpen, openOrderDetail, refreshActiveOrder };

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            generationRef.current += 1;
            if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
        };
    }, []);

    useEffect(() => {
        const sdk = sdkRef.current;
        const sessionId = sessionIdRef.current;
        if (configureGeneration === null || !fieldContainer || !sdk || !sessionId) return;
        const generation = configureGeneration;
        sdk.configure({
            session: sessionId,
            fields: {
                card: {
                    number: `#${CARD_FIELD_IDS.cardNumber}`,
                    securityCode: `#${CARD_FIELD_IDS.securityCode}`,
                    expiryMonth: `#${CARD_FIELD_IDS.expiryMonth}`,
                    expiryYear: `#${CARD_FIELD_IDS.expiryYear}`,
                },
            },
            frameEmbeddingMitigation: ["javascript"],
            callbacks: {
                initialized: (result): void => onInitialized(result, generation),
                formSessionUpdate: (result): void => onSessionUpdated(result, generation),
            },
        });
        // Configure exactly once per (session, mounted container); the callbacks read live state
        // through refs, so they never need to be re-created.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [configureGeneration, fieldContainer]);

    const available =
        !isAdmin && !isKiosk && token !== null && cartItems.length > 0 &&
        prefetch !== null && prefetch.eligible && !prefetch.banned && !!prefetch.profile.name;
    const signInRequired = !isAdmin && !isKiosk && !isAuthLoading && token === null;

    function release(): void {
        busyRef.current = false;
        if (mountedRef.current) setBusy(false);
    }

    function goTo(next: CardCheckoutStep): void {
        stepRef.current = next;
        if (mountedRef.current) setStep(next);
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

    function isStale(generation: number): boolean {
        return !mountedRef.current || generation !== generationRef.current;
    }

    // Detaches the drawer without touching busyRef: a PENDING/REVIEW payment keeps blocking.
    function dismissDrawer(): void {
        generationRef.current += 1;
        sessionIdRef.current = null;
        sdkRef.current = null;
        submitRef.current = false;
        goTo("idle");
        if (!mountedRef.current) return;
        setConfigureGeneration(null);
        setFieldErrors({});
        setDrawerOpen(false);
    }

    function abandon(): void {
        dismissDrawer();
        release();
    }

    function completeSuccess(order: PendingOrder): void {
        const h = handlers.current;
        clearNotice();
        trackApplePayPurchase(order.orderId, order.amount, order.tel);
        // A paid order must never be re-sent: the next identical cart needs a fresh key and order.
        orderKeyRef.current = null;
        orderRef.current = null;
        h.setCartItems([]);
        h.setPaymentMethod(DEFAULT_PAYMENT_METHOD);
        h.setOrderType("Pick Up");
        h.setCartOpen(false);
        dismissDrawer();
        h.refreshActiveOrder();
        h.openOrderDetail(order.orderId);
        release();
    }

    function declineMessage(reason: CardDeclineReason | null): string {
        return handlers.current.t(DECLINE_MESSAGE_KEY[reason ?? "DECLINED"]);
    }

    function handleResolvedWhilePolling(result: CardPaymentResponse, order: PendingOrder): void {
        if (result.status === "APPROVED") {
            completeSuccess(order);
        } else if (result.status === "DECLINED") {
            clearNotice();
            report(declineMessage(result.reason));
            release();
        }
    }

    function pollOrder(order: PendingOrder): void {
        pollUntilResolved({
            getToken: () => latest.current.token,
            isMounted: () => mountedRef.current,
            onTimer: timer => { pollTimerRef.current = timer; },
            fetchStatus: accessToken => fetchCardPaymentStatus(accessToken, order.orderId),
            failureLabel: "Card status poll failed:",
            onResolved: result => handleResolvedWhilePolling(result, order),
            onReview: () => showNotice(handlers.current.t("errors.review")),
            onUnresolved: () => showNotice(handlers.current.t("errors.unresolved")),
        });
    }

    function failCreateOrder(failure: unknown, submitted: CartItem[]): void {
        reportCreateOrderFailure(
            failure, submitted, handlers.current, report,
            f => f instanceof CardPaymentApiError && f.code === IN_PROGRESS_CODE,
        );
    }

    // Steps 4-8: a session is single-use, so this also serves every retry for the same order.
    async function prepareSession(order: PendingOrder, generation: number): Promise<void> {
        goTo("preparing");
        const accessToken = latest.current.token;
        try {
            if (!accessToken) throw new CardPaymentApiError("NO_TOKEN", 401);
            const session = await createCardSession(accessToken, order.orderId);
            if (isStale(generation)) return;
            let sdk: PaymentSessionStatic;
            try {
                sdk = await loadHostedSessionScript(session.scriptUrl, session.apiVersion);
            } catch (failure: unknown) {
                logger.error("Hosted session script failed:", describeError(failure));
                if (isStale(generation)) return;
                report(handlers.current.t("errors.scriptFailed"));
                goTo("needsNewSession");
                return;
            }
            if (isStale(generation)) return;
            if (window.self !== window.top) {
                logger.error("Card payment refused: page is framed");
                report(handlers.current.t("errors.framed"));
                abandon();
                return;
            }
            sessionIdRef.current = session.sessionId;
            sdkRef.current = sdk;
            if (mountedRef.current) setConfigureGeneration(generation);
        } catch (failure: unknown) {
            logger.error("Card session could not be created:", describeError(failure));
            if (isStale(generation)) return;
            const inProgress = failure instanceof CardPaymentApiError && failure.code === IN_PROGRESS_CODE;
            report(handlers.current.t(inProgress ? "errors.inProgress" : "errors.sessionFailed"));
            goTo("needsNewSession");
        }
    }

    async function createOrderAndPrepare(profile: CustomerMeResponse, generation: number): Promise<void> {
        const { items, orderType: currentOrderType, branchId } = latest.current;
        try {
            const accessToken = latest.current.token;
            if (!accessToken) throw new CardPaymentApiError("NO_TOKEN", 401);
            const { amount, sheetAmount } = computeSheetTotal(items);
            const orderItems = buildOrderItems(items);
            // The branch is part of the signature: the backend returns the existing order for a
            // reused key without comparing the body, so a branch switch must get a new order.
            const signature = JSON.stringify([orderItems, currentOrderType, sheetAmount, branchId]);
            if (orderKeyRef.current?.signature !== signature) {
                orderKeyRef.current = { signature, key: newIdempotencyKey() };
            }
            const request: CreateOrderRequest = {
                tel: profile.phone,
                customer_name: profile.name,
                type: currentOrderType,
                payment_type: "Card",
                branchId,
                notes: "",
                items: orderItems,
                amount_paid: amount,
                fbc: resolveFbc(),
                fbp: resolveFbp(),
                language: resolveCustomerLanguage(handlers.current.language, true),
                idempotency_key: orderKeyRef.current.key,
            };
            const created = await createCardOrder(accessToken, request);
            if (isStale(generation)) return;
            if (created.amount !== sheetAmount) {
                logger.error("Card amount mismatch for order", created.orderId);
                report(handlers.current.t("errors.amountMismatch"));
                abandon();
                return;
            }
            const order: PendingOrder = { orderId: created.orderId, amount, tel: profile.phone, items };
            orderRef.current = order;
            await prepareSession(order, generation);
        } catch (failure: unknown) {
            logger.error("Card order could not be created:", describeError(failure));
            if (isStale(generation)) return;
            failCreateOrder(failure, items);
            abandon();
        }
    }

    function onInitialized(result: HostedSessionInitializedResult, generation: number): void {
        if (isStale(generation)) return;
        if (result.status === "ok") {
            goTo("ready");
            return;
        }
        logger.warn("Hosted session init failed:", result.status);
        report(handlers.current.t("errors.systemError"));
        goTo("needsNewSession");
    }

    function onSessionUpdated(result: HostedSessionUpdateResult, generation: number): void {
        // Only the first result of a submit may act: payWithSession moves the step to "paying"
        // synchronously, so a repeated callback while the pay is in flight is a no-op.
        if (isStale(generation) || !submitRef.current || stepRef.current !== "updatingSession") return;
        if (result.status === "ok") {
            void payWithSession();
            return;
        }
        submitRef.current = false;
        if (result.status === "fields_in_error") {
            setFieldErrors(readFieldErrors(result.errors));
            report(handlers.current.t("errors.fieldsInError"));
        } else {
            logger.warn("Hosted session update failed:", result.status);
            report(handlers.current.t("errors.systemError"));
        }
        goTo("ready");
    }

    function handlePayResult(result: CardPaymentResponse, order: PendingOrder): void {
        if (result.status === "APPROVED") {
            completeSuccess(order);
        } else if (result.status === "DECLINED") {
            // The session is spent; the customer needs a new one (and a new attemptKey) to retry.
            submitRef.current = false;
            sessionIdRef.current = null;
            report(declineMessage(result.reason));
            goTo("needsNewSession");
        } else if (result.status === "REVIEW") {
            dismissDrawer();
            showNotice(handlers.current.t("errors.review"));
        } else {
            dismissDrawer();
            showNotice(handlers.current.t("pending"));
            pollOrder(order);
        }
    }

    async function payWithSession(): Promise<void> {
        const order = orderRef.current;
        const sessionId = sessionIdRef.current;
        const accessToken = latest.current.token;
        if (!order || !sessionId || !accessToken) {
            submitRef.current = false;
            report(handlers.current.t("errors.generic"));
            goTo("needsNewSession");
            return;
        }
        goTo("paying");
        try {
            const result = await payCardOrder(accessToken, order.orderId, {
                attemptKey: newIdempotencyKey(),
                sessionId,
                fbc: resolveFbc() ?? null,
                fbp: resolveFbp() ?? null,
            });
            handlePayResult(result, order);
        } catch (failure: unknown) {
            logger.error("Card payment failed:", describeError(failure));
            // Any pay-stage failure that is not a documented definitive rejection (5xx, transport)
            // may still have charged the customer: resolve it through the status endpoint.
            if (!isDefinitivePayRejection(failure, CardPaymentApiError, DEFINITIVE_PAY_REJECTIONS)) {
                dismissDrawer();
                showNotice(handlers.current.t("pending"));
                pollOrder(order);
                return;
            }
            failCreateOrder(failure, order.items);
            abandon();
        }
    }

    function start(): void {
        const profile = latest.current.prefetch?.profile;
        if (busyRef.current || !profile || !latest.current.token) return;
        busyRef.current = true;
        setBusy(true);
        setError(null);
        setFieldErrors({});
        setConfigureGeneration(null);
        setDrawerOpen(true);
        generationRef.current += 1;
        goTo("preparing");
        void createOrderAndPrepare(profile, generationRef.current);
    }

    function submit(): void {
        const sdk = sdkRef.current;
        if (submitRef.current || stepRef.current !== "ready" || !sdk) return;
        submitRef.current = true;
        goTo("updatingSession");
        setFieldErrors({});
        setError(null);
        try {
            sdk.updateSessionFromForm("card");
        } catch (failure: unknown) {
            logger.error("Hosted session update could not start:", describeError(failure));
            submitRef.current = false;
            report(handlers.current.t("errors.systemError"));
            goTo("ready");
        }
    }

    function retryWithNewSession(): void {
        const order = orderRef.current;
        if (stepRef.current !== "needsNewSession" || !order) return;
        submitRef.current = false;
        sessionIdRef.current = null;
        setError(null);
        setFieldErrors({});
        setConfigureGeneration(null);
        generationRef.current += 1;
        void prepareSession(order, generationRef.current);
    }

    function closeDrawer(): void {
        if (stepRef.current === "updatingSession" || stepRef.current === "paying") return;
        abandon();
    }

    return {
        available, signInRequired, busy, start,
        drawerOpen, closeDrawer, step, fieldErrors,
        error, clearError: () => setError(null), notice,
        submit, retryWithNewSession,
        fieldContainerRef: setFieldContainer,
    };
}
