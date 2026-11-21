import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { createOrder } from "../../../../../shared/api/public";
import { resolveCustomerLanguage } from "../../../../../shared/utils/customerLanguage";
import { newIdempotencyKey } from "../../../../../shared/utils/idempotencyKey";
import { logger } from "../../../../../shared/utils/logger";
import type { CartItem } from "../../../../menu/types";
import { ItemsUnavailableError } from "../../../../order/types";
import type { CreateOrderRequest } from "../../../../order/types";
import { buildOrderItems, computeAmountPaid } from "../../../../order/utils/orderPayload";
import { useOrderLines } from "./useOrderLines";
import type { UseOrderLinesResult } from "./useOrderLines";
import type { OrderEditSummaryData } from "./useOrderEdit";

/** The board skips the new-order sound for these ids: the staff member placed them here. */
const SUPPRESS_SOUND_KEY = "suppressSoundIds";

/** items → the details step → saving → the 10-second summary. */
export type OrderCreateStep = "items" | "details" | "saving" | "placed";

/** What the details step collects: the same fields the admin menu's "User Data" sheet asks for. */
export interface OrderCreateDetails {
    /** Full number with the country code, or null when the staff member left it empty. */
    phone: string | null;
    customerName: string;
    paymentType: string;
    /** Percent, applied to every line (the admin sheet's "Order Discount"). */
    discountPercent: number;
}

export interface UseOrderCreateResult extends UseOrderLinesResult {
    step: OrderCreateStep;
    /** Moves to the details step; ignored while the order is empty. */
    toDetails: () => void;
    backToItems: () => void;
    place: (details: OrderCreateDetails) => Promise<void>;
    placeError: string | null;
    /** Set once the order was placed: the summary shown for 10 seconds. */
    summary: OrderEditSummaryData | null;
    /** Goes up each time the backend refused items as unavailable: the menu should be reloaded. */
    unavailableNotice: number;
}

function withDiscount(items: CartItem[], discountPercent: number): CartItem[] {
    return items.map(item => ({ ...item, discountAmount: discountPercent }));
}

function rememberPlacedHere(orderId: string): void {
    localStorage.setItem(SUPPRESS_SOUND_KEY, JSON.stringify([orderId]));
}

/**
 * A new staff order built in the quick popup. The request is the one the admin menu page sends
 * (useCheckout, the isAdmin branch): every staff order is filed as "Pick Up" with the chosen
 * payment type, and the staff member's own screen does not play the new-order sound for it.
 */
export function useOrderCreate(branchId: string): UseOrderCreateResult {
    const { i18n } = useTranslation();
    const lines = useOrderLines([]);
    const [step, setStep] = useState<OrderCreateStep>("items");
    const [placeError, setPlaceError] = useState<string | null>(null);
    const [summary, setSummary] = useState<OrderEditSummaryData | null>(null);
    const [unavailableNotice, setUnavailableNotice] = useState(0);
    const placingRef = useRef(false);
    // One key per order being built: a retry after a network failure is deduplicated by the backend.
    const idempotencyKeyRef = useRef(newIdempotencyKey());

    function toDetails(): void {
        if (lines.items.length === 0) return;
        setPlaceError(null);
        setStep("details");
    }

    function backToItems(): void {
        if (step === "saving") return;
        setStep("items");
    }

    async function place(details: OrderCreateDetails): Promise<void> {
        if (placingRef.current || lines.items.length === 0) return;
        placingRef.current = true;
        setStep("saving");
        setPlaceError(null);
        const items = withDiscount(lines.items, details.discountPercent);
        const request: CreateOrderRequest = {
            tel: details.phone,
            customer_name: details.customerName,
            type: "Pick Up",
            payment_type: details.paymentType,
            branchId,
            notes: "",
            items: buildOrderItems(items),
            amount_paid: computeAmountPaid(items),
            language: resolveCustomerLanguage(i18n.language, true),
            idempotency_key: idempotencyKeyRef.current,
        };
        try {
            const created = await createOrder(request);
            rememberPlacedHere(String(created.id));
            setSummary({ added: lines.diff.added, removed: [], originalTotal: 0, editedTotal: request.amount_paid });
            setStep("placed");
        } catch (err) {
            logger.error("New staff order: placing the order failed:", err);
            if (err instanceof ItemsUnavailableError) {
                const unavailable = new Set(err.unavailableIds);
                lines.dropItems(item => unavailable.has(item.id));
                setUnavailableNotice(n => n + 1);
                // The items changed, so this is a different order: it gets its own key.
                idempotencyKeyRef.current = newIdempotencyKey();
                setStep("items");
            } else {
                setStep("details");
            }
            setPlaceError(err instanceof Error ? err.message : String(err));
        } finally {
            placingRef.current = false;
        }
    }

    return { ...lines, step, toDetails, backToItems, place, placeError, summary, unavailableNotice };
}
