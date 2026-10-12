// Types for the card (Hosted Session) endpoints (task-spec.md §4.1 C-1..C-5).

export type CardEligibilityResponse = { enabled: boolean };

export type CardOrderResponse = {
    orderId: number;
    amount: string;
    currency: "BHD";
    status: string;
};

export type CardSessionResponse = {
    sessionId: string;
    scriptUrl: string;
    apiVersion: "100";
};

export type CardPayRequest = {
    attemptKey: string;
    sessionId: string;
    fbc?: string | null;
    fbp?: string | null;
};

export type CardPaymentStatus = "APPROVED" | "DECLINED" | "PENDING" | "REVIEW";

export type CardDeclineReason = "DECLINED" | "AUTHENTICATION_REQUIRED" | "REJECTED";

export type CardPaymentResponse = {
    orderId: number;
    status: CardPaymentStatus;
    reason: CardDeclineReason | null;
    amount: string;
    currency: "BHD";
};

// `code` is the stable message token from the backend (e.g. CARD_PAYMENT_IN_PROGRESS);
// callers key off it, never off prose.
export class CardPaymentApiError extends Error {
    readonly code: string;
    readonly status: number;

    constructor(code: string, status: number) {
        super(code);
        this.name = "CardPaymentApiError";
        this.code = code;
        this.status = status;
    }
}
