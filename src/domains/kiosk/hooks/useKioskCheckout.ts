import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Dispatch, SetStateAction } from "react";
import { logger } from "../../../shared/utils/logger";
import { resolveFbc, resolveFbp } from "../../../shared/utils/adAttribution";
import { resolveCustomerLanguage } from "../../../shared/utils/customerLanguage";
import { abandonKioskOrder, createKioskOrder, initiateKioskPayment } from "../../../shared/api/kiosk";
import { KioskUnauthorizedError } from "../../../shared/api/kioskClient";
import { ItemsUnavailableError, BranchClosedError } from "../../order/types";
import type { CreateOrderRequest } from "../../order/types";
import type { CartItem } from "../../menu/types";
import { buildOrderItems, computeAmountPaid } from "../../order/utils/orderPayload";
import { resolveKioskBranchId } from "../utils/kioskBranch";
import { useKioskPaymentPolling } from "./useKioskPaymentPolling";
import type { KioskPaymentStatus } from "./useKioskPaymentPolling";
import type { PaymentResultResponse } from "../../../shared/api/kiosk";

/**
 * Where the walk-up customer is in the kiosk checkout.
 *
 * `submitting` is deliberately NOT a phase but a separate boolean: the phone sheet must stay mounted
 * while the order is created and the terminal armed, so an error lands back on the same sheet
 * without a remount that would wipe the digits the customer just typed.
 */
export type KioskPhase =
    | "idle"
    | "phone"
    | "awaiting-card"
    | "failed"
    | "mismatch"
    | "approved"
    | "deferred";

/** Terminal statuses that route to the "pay at the front desk?" offer. */
const FAILURE_STATUSES: ReadonlySet<KioskPaymentStatus> = new Set<KioskPaymentStatus>([
    "DECLINED",
    "CANCELLED",
    "EXPIRED",
    "ERROR",
    "TIMEOUT",
]);

export interface UseKioskCheckoutParams {
    isKiosk: boolean;
    setCartItems: Dispatch<SetStateAction<CartItem[]>>;
    setCartOpen: Dispatch<SetStateAction<boolean>>;
    refreshMenu: () => Promise<void>;
    /** Reuses the existing cart-level unavailable popup rather than growing a kiosk-only one. */
    onItemsUnavailable: (removedNames: string[], message: string) => void;
    /** The device's pairing is gone or revoked — the page reopens the terminal picker. */
    onUnauthorized: () => void;
    /** Wipe everything for the next customer (see resetKioskSession). */
    onSessionEnd: () => void;
}

export interface UseKioskCheckoutResult {
    phase: KioskPhase;
    /** True while an order-create / terminal-arm attempt is in flight. */
    submitting: boolean;
    /** Order or terminal failure shown inline on the phone sheet. Cleared at each attempt. */
    checkoutError: string | null;
    /** The order being paid for — the failure sheet needs it to defer or abandon. */
    pendingOrderId: string | null;
    paymentStatus: KioskPaymentStatus;
    paymentResult: PaymentResultResponse | null;
    secondsRemaining: number;
    /** Transient poll failure; shown as "reconnecting", never as a failed payment. */
    pollError: string | null;
    /** Any kiosk surface is up — used to suppress the floating cart pill and scroll hint. */
    isSheetOpen: boolean;
    startPhoneStep: (items: CartItem[]) => void;
    closePhoneStep: () => void;
    submitPhone: (tel: string) => Promise<void>;
    /** Customer pressed Cancel while the terminal was waiting. */
    cancelPayment: () => Promise<void>;
    /** The failure sheet successfully deferred the order to the counter. */
    handleDeferred: () => void;
    /** The failure sheet abandoned the order (or the customer walked away). */
    handleAbandoned: () => void;
    /** Confirmation/counter sheet dismissed, by button or auto-return. */
    finishSession: () => void;
}

export function useKioskCheckout(params: UseKioskCheckoutParams): UseKioskCheckoutResult {
    const { isKiosk, setCartItems, setCartOpen, refreshMenu, onItemsUnavailable, onUnauthorized, onSessionEnd } = params;
    const { t, i18n } = useTranslation("kiosk");

    const [phase, setPhase] = useState<KioskPhase>("idle");
    const [submitting, setSubmitting] = useState(false);
    const [checkoutError, setCheckoutError] = useState<string | null>(null);
    const [pendingItems, setPendingItems] = useState<CartItem[]>([]);
    const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
    const [invoiceNum, setInvoiceNum] = useState<string | null>(null);

    /**
     * Synchronous double-tap guard. A second press that lands before React has flushed
     * `setSubmitting(true)` still reads the pre-update closure value, so the guard must not depend on
     * render timing — this is the only layer that prevents a second ORDER (the server's pessimistic
     * lock only prevents a second CHARGE).
     */
    const submittingRef = useRef(false);
    /**
     * Survives a failed `initiatePayment` so a retry re-arms the terminal for the SAME order instead
     * of creating a duplicate. Read-after-write within one `submitPhone` call, so it cannot be state.
     */
    const pendingOrderIdRef = useRef<string | null>(null);
    /** Latest onSessionEnd without putting it in effect deps. */
    const onSessionEndRef = useRef(onSessionEnd);
    onSessionEndRef.current = onSessionEnd;

    // Passing null outside `awaiting-card` is what stops the loop the moment a terminal status has
    // been consumed — no second guard needed inside the polling hook.
    const polling = useKioskPaymentPolling(phase === "awaiting-card" ? invoiceNum : null);

    const clearLocalState = useCallback((): void => {
        submittingRef.current = false;
        pendingOrderIdRef.current = null;
        setSubmitting(false);
        setCheckoutError(null);
        setPendingItems([]);
        setPendingOrderId(null);
        setInvoiceNum(null);
        setPhase("idle");
    }, []);

    const endSession = useCallback((): void => {
        clearLocalState();
        onSessionEndRef.current();
    }, [clearLocalState]);

    /** Best-effort: nobody is present to be shown a retry affordance or an error. */
    const abandonPendingOrder = useCallback((): void => {
        const orderId = pendingOrderIdRef.current;
        if (orderId !== null) {
            abandonKioskOrder(orderId).catch(() => {});
        }
        pendingOrderIdRef.current = null;
    }, []);

    function startPhoneStep(items: CartItem[]): void {
        setPendingItems(items);
        setCheckoutError(null);
        setCartOpen(false);
        setPhase("phone");
    }

    function closePhoneStep(): void {
        // The customer backed out before paying — the unpaid order must not be left behind. The cart
        // itself is preserved so they can edit it and come back.
        abandonPendingOrder();
        clearLocalState();
        setCartOpen(true);
    }

    async function submitPhone(tel: string): Promise<void> {
        if (submittingRef.current) return;
        submittingRef.current = true;
        setCheckoutError(null);
        setSubmitting(true);

        let orderId = pendingOrderIdRef.current;

        if (orderId === null) {
            const order: CreateOrderRequest = {
                tel,
                // Locked product decision: the kiosk asks for a phone number only.
                customer_name: null,
                type: "Pick Up",
                payment_type: "Card",
                // All three above, plus branchId, are overridden server-side from the kiosk
                // principal; sent anyway so the payload stays shape-complete.
                branchId: resolveKioskBranchId(),
                notes: "",
                items: buildOrderItems(pendingItems),
                amount_paid: computeAmountPaid(pendingItems),
                fbc: resolveFbc(),
                fbp: resolveFbp(),
                // The kiosk's browser locale is the store's device, not the walk-up customer's.
                language: resolveCustomerLanguage(i18n.language, false),
            };

            try {
                const response = await createKioskOrder(order);
                orderId = String(response.id);
                pendingOrderIdRef.current = orderId;
                setPendingOrderId(orderId);
            } catch (e) {
                if (e instanceof ItemsUnavailableError) {
                    const removed = pendingItems.filter(item => e.unavailableIds.includes(item.id));
                    const remaining = pendingItems.filter(item => !e.unavailableIds.includes(item.id));
                    setCartItems(remaining);
                    // The kiosk reopens the cart unconditionally, unlike the admin branch which only
                    // does so when items remain: a walk-up customer needs to see what was dropped.
                    setCartOpen(true);
                    onItemsUnavailable(removed.map(i => i.name), e.message);
                    clearLocalState();
                    refreshMenu().catch(() => {});
                    return;
                }
                if (e instanceof KioskUnauthorizedError) {
                    clearLocalState();
                    onUnauthorized();
                    return;
                }
                logger.error("Error creating kiosk order:", e);
                setCheckoutError(e instanceof BranchClosedError ? t("errors.branchClosed") : t("errors.generic"));
                submittingRef.current = false;
                setSubmitting(false);
                return;
            }
        }

        try {
            const { invoiceNum: nextInvoice } = await initiateKioskPayment(orderId);
            setInvoiceNum(nextInvoice);
            setPhase("awaiting-card");
            submittingRef.current = false;
            setSubmitting(false);
        } catch (e) {
            if (e instanceof KioskUnauthorizedError) {
                clearLocalState();
                onUnauthorized();
                return;
            }
            // pendingOrderIdRef stays set: the next attempt re-arms the terminal for this same
            // order and must never create a second one.
            logger.error("Error initiating kiosk payment:", e);
            setCheckoutError(t("errors.generic"));
            submittingRef.current = false;
            setSubmitting(false);
        }
    }

    async function cancelPayment(): Promise<void> {
        await polling.cancel();
        abandonPendingOrder();
        endSession();
    }

    function handleDeferred(): void {
        pendingOrderIdRef.current = null;
        setPhase("deferred");
    }

    function handleAbandoned(): void {
        pendingOrderIdRef.current = null;
        endSession();
    }

    // Consume the poll's terminal status exactly once, translating it into a phase.
    const pollStatus = polling.status;
    useEffect(() => {
        if (phase !== "awaiting-card") return;

        if (pollStatus === "APPROVED") {
            // The backend has already settled the payment and published the ticket to the kitchen —
            // there is nothing for the client to send here.
            setCartItems([]);
            setPhase("approved");
            return;
        }
        // Undercharge: money has already left the customer's card. Never abandon (that would
        // hard-delete an order with a live partial capture against it) and never defer — a human
        // has to intervene. This status must bypass the whole Yes/No machinery.
        if (pollStatus === "AMOUNT_MISMATCH") {
            setPhase("mismatch");
            return;
        }
        if (FAILURE_STATUSES.has(pollStatus)) {
            setPhase("failed");
        }
    }, [pollStatus, phase, setCartItems]);

    // A kiosk tab that leaves kiosk mode (or unmounts) must not strand an unpaid order.
    useEffect(() => {
        if (isKiosk) return;
        clearLocalState();
    }, [isKiosk, clearLocalState]);

    return {
        phase,
        submitting,
        checkoutError,
        pendingOrderId,
        paymentStatus: polling.status,
        paymentResult: polling.result,
        secondsRemaining: polling.secondsRemaining,
        pollError: polling.error,
        isSheetOpen: phase !== "idle",
        startPhoneStep,
        closePhoneStep,
        submitPhone,
        cancelPayment,
        handleDeferred,
        handleAbandoned,
        finishSession: endSession,
    };
}
