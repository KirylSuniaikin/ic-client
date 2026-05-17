export type PaymentSessionStatus = "PAID" | "FAILED" | "INITIATED" | "EXPIRED";

export type PaymentResultUIState = "loading" | "success" | "failed" | "timeout";

export interface InitiateSessionResponse {
    sessionId: string;
}

export interface CredimaxStatusResponse {
    orderId: number;
    status: PaymentSessionStatus;
}

export interface PersistedCartData {
    orderId: number;
    savedAt: number;
}

export interface PaymentConfig {
    merchantId: string;
}
