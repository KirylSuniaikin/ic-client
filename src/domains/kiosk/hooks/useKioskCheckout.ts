import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Dispatch, SetStateAction } from "react";
import { logger } from "../../../shared/utils/logger";
import { resolveFbc, resolveFbp } from "../../../shared/utils/adAttribution";
import { resolveCustomerLanguage } from "../../../shared/utils/customerLanguage";
import { createOrder } from "../../../shared/api/public";
import { ItemsUnavailableError, BranchClosedError, DEFAULT_PAYMENT_METHOD } from "../../order/types";
import type { CreateOrderRequest } from "../../order/types";
import type { CartItem } from "../../menu/types";
import { buildOrderItems, computeAmountPaid } from "../../order/utils/orderPayload";
import { resolveKioskBranchId } from "../utils/kioskBranch";

/**
 * Where the walk-up customer is in the kiosk checkout: cart -> phone number -> order placed.
 *
 * The kiosk takes no payment. The order is created unpaid and the customer settles it at the
 * counter, which is why `placed` is a terminal phase with nothing to poll or confirm.
 *
 * `submitting` is deliberately NOT a phase but a separate boolean: the phone sheet must stay
 * mounted while the order is created, so an error lands back on the same sheet without a remount
 * that would wipe the digits the customer just typed.
 */
export type KioskPhase = "idle" | "phone" | "placed";

export interface UseKioskCheckoutParams {
    isKiosk: boolean;
    setCartItems: Dispatch<SetStateAction<CartItem[]>>;
    setCartOpen: Dispatch<SetStateAction<boolean>>;
    refreshMenu: () => Promise<void>;
    /** Reuses the existing cart-level unavailable popup rather than growing a kiosk-only one. */
    onItemsUnavailable: (removedNames: string[], message: string) => void;
    /** Wipe everything for the next customer (see resetKioskSession). */
    onSessionEnd: () => void;
}

export interface UseKioskCheckoutResult {
    phase: KioskPhase;
    /** True while an order-create attempt is in flight. */
    submitting: boolean;
    /** Order failure shown inline on the phone sheet. Cleared at each attempt. */
    checkoutError: string | null;
    /** The number the customer quotes at the counter. */
    placedOrderId: string | null;
    /** Any kiosk surface is up — used to suppress the floating cart pill and scroll hint. */
    isSheetOpen: boolean;
    startPhoneStep: (items: CartItem[]) => void;
    closePhoneStep: () => void;
    submitPhone: (tel: string, customerName: string) => Promise<void>;
    /** Confirmation sheet dismissed, by button or auto-return. */
    finishSession: () => void;
}

export function useKioskCheckout(params: UseKioskCheckoutParams): UseKioskCheckoutResult {
    const { isKiosk, setCartItems, setCartOpen, refreshMenu, onItemsUnavailable, onSessionEnd } = params;
    const { t, i18n } = useTranslation("kiosk");

    const [phase, setPhase] = useState<KioskPhase>("idle");
    const [submitting, setSubmitting] = useState(false);
    const [checkoutError, setCheckoutError] = useState<string | null>(null);
    const [pendingItems, setPendingItems] = useState<CartItem[]>([]);
    const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);

    /**
     * Synchronous double-tap guard. A second press that lands before React has flushed
     * `setSubmitting(true)` still reads the pre-update closure value, so the guard must not depend
     * on render timing — this is the only thing standing between an impatient customer and a
     * duplicate order.
     */
    const submittingRef = useRef(false);
    /** Latest onSessionEnd without putting it in effect deps. */
    const onSessionEndRef = useRef(onSessionEnd);
    onSessionEndRef.current = onSessionEnd;

    const clearLocalState = useCallback((): void => {
        submittingRef.current = false;
        setSubmitting(false);
        setCheckoutError(null);
        setPendingItems([]);
        setPlacedOrderId(null);
        setPhase("idle");
    }, []);

    const endSession = useCallback((): void => {
        clearLocalState();
        onSessionEndRef.current();
    }, [clearLocalState]);

    function startPhoneStep(items: CartItem[]): void {
        setPendingItems(items);
        setCheckoutError(null);
        setCartOpen(false);
        setPhase("phone");
    }

    function closePhoneStep(): void {
        // The customer backed out before giving a number. Nothing was created, so the cart is
        // simply handed back to them to edit.
        clearLocalState();
        setCartOpen(true);
    }

    async function submitPhone(tel: string, customerName: string): Promise<void> {
        if (submittingRef.current) return;
        submittingRef.current = true;
        setCheckoutError(null);
        setSubmitting(true);

        const order: CreateOrderRequest = {
            tel,
            // The kiosk asks for a name so the order can be called out when it is ready.
            customer_name: customerName,
            type: "Pick Up",
            // The kiosk cart hides the payment selector, so there is no customer choice to carry
            // here — the order goes to the counter to be settled, same as before the kiosk ever
            // had a card terminal.
            payment_type: DEFAULT_PAYMENT_METHOD,
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
            const response = await createOrder(order);
            setCartItems([]);
            setPlacedOrderId(String(response.id));
            setPhase("placed");
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
            logger.error("Error creating kiosk order:", e);
            setCheckoutError(e instanceof BranchClosedError ? t("errors.branchClosed") : t("errors.generic"));
        } finally {
            submittingRef.current = false;
            setSubmitting(false);
        }
    }

    // A kiosk tab that leaves kiosk mode (or unmounts) must not strand a half-finished checkout.
    useEffect(() => {
        if (isKiosk) return;
        clearLocalState();
    }, [isKiosk, clearLocalState]);

    return {
        phase,
        submitting,
        checkoutError,
        placedOrderId,
        isSheetOpen: phase !== "idle",
        startPhoneStep,
        closePhoneStep,
        submitPhone,
        finishSession: endSession,
    };
}
