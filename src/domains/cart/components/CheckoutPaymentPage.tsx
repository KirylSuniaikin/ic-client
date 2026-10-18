import { PaymentPage } from "./PaymentPage";
import type { PaymentPageProps } from "./PaymentPage";
import { APPLE_PAY_CHOICE, CARD_CHOICE, isTenderChoice, usePaymentChoice } from "../hooks/usePaymentChoice";
import type { PaymentChoice } from "../hooks/usePaymentChoice";
import { PAY_ONLINE_METHOD } from "../../order/types";
import type { UseApplePayCheckoutResult } from "../../order/hooks/useApplePayCheckout";
import type { UseCardCheckoutResult } from "../../order/hooks/useCardCheckout";
import type { DeliveryPaymentMethod } from "../../delivery/types";
import { logger } from "../../../shared/utils/logger";

/** A pickup order: card and Apple Pay run their own checkouts, the rest travel as the order's tender. */
interface PickupPayment {
    kind: "pickup";
    applePay?: Pick<UseApplePayCheckoutResult, "available" | "busy" | "start">;
    cardPayment?: Pick<UseCardCheckoutResult, "available" | "busy" | "start">;
    onPayWithTender: (tender: string) => void;
}

/** A delivery order: paid on EazyPay's hosted page, after the address step. */
interface DeliveryPayment {
    kind: "delivery";
    onPayDelivery: (method: DeliveryPaymentMethod) => void;
}

export type CheckoutPaymentPageProps =
    Omit<PaymentPageProps, "choices" | "selected" | "onSelect" | "onPay">
    & { payment: PickupPayment | DeliveryPayment };

// The delivery checkout's method codes for the choices usePaymentChoice offers a delivery order.
const DELIVERY_METHODS: Partial<Record<PaymentChoice, DeliveryPaymentMethod>> = {
    [CARD_CHOICE]: "CARD",
    [APPLE_PAY_CHOICE]: "APPLE_PAY",
    [PAY_ONLINE_METHOD]: "BENEFIT",
};

/**
 * The payment page with its methods and its Pay wired up, for a pickup order straight after the
 * cart (and sign-in), or for a delivery order after its address. Mounted only while open, so every
 * opening starts with nothing chosen.
 */
export function CheckoutPaymentPage({ payment, busy, ...page }: CheckoutPaymentPageProps): JSX.Element {
    const pickup = payment.kind === "pickup" ? payment : null;
    const { choices, selected, select } = usePaymentChoice({
        applePayAvailable: pickup?.applePay?.available === true,
        cardAvailable: pickup?.cardPayment?.available === true,
        forDelivery: payment.kind === "delivery",
    });

    function pay(choice: PaymentChoice): void {
        if (payment.kind === "delivery") {
            const method = DELIVERY_METHODS[choice];
            if (method === undefined) {
                logger.warn("No delivery payment method for choice:", choice);
                return;
            }
            payment.onPayDelivery(method);
            return;
        }
        if (choice === APPLE_PAY_CHOICE) payment.applePay?.start();
        else if (choice === CARD_CHOICE) payment.cardPayment?.start();
        else if (isTenderChoice(choice)) payment.onPayWithTender(choice);
    }

    const methodBusy =
        (selected === APPLE_PAY_CHOICE && pickup?.applePay?.busy === true) ||
        (selected === CARD_CHOICE && pickup?.cardPayment?.busy === true);

    return (
        <PaymentPage
            {...page}
            choices={choices}
            selected={selected}
            onSelect={select}
            onPay={pay}
            busy={busy || methodBusy}
        />
    );
}
