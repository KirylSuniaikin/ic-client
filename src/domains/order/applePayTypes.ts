// Types for the Apple Pay endpoints (task-spec.md §5 "Frozen API contracts" F-1..F-5).

export type ApplePayEligibilityResponse = { enabled: boolean };

export type MerchantSessionRequest = { validationUrl: string };

export type ApplePayOrderResponse = {
    orderId: number;
    amount: string;
    currency: "BHD";
    status: string;
};

export type ApplePayPayRequest = {
    attemptKey: string;
    paymentToken: string;
    fbc?: string | null;
    fbp?: string | null;
};

export type ApplePayPaymentStatus = "APPROVED" | "DECLINED" | "PENDING" | "REVIEW";

export type ApplePayPaymentResponse = {
    orderId: number;
    status: ApplePayPaymentStatus;
    amount: string;
    currency: "BHD";
};

// `code` is the stable message token from the backend (e.g. APPLE_PAY_PAYMENT_IN_PROGRESS);
// callers key off it, never off prose.
export class ApplePayApiError extends Error {
    readonly code: string;
    readonly status: number;

    constructor(code: string, status: number) {
        super(code);
        this.name = "ApplePayApiError";
        this.code = code;
        this.status = status;
    }
}
