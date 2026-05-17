import { CredimaxStatusResponse, InitiateSessionResponse, PaymentConfig } from "../types/payment";
import { URL } from "./api";

export async function initiatePaymentSession(orderId: number): Promise<InitiateSessionResponse> {
    const response = await fetch(`${URL}/payment/initiate-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
    });

    if (!response.ok) {
        throw new Error(`Failed to initiate payment session: ${response.status}`);
    }

    return response.json();
}

export async function getPaymentStatus(orderId: number): Promise<CredimaxStatusResponse> {
    const response = await fetch(`${URL}/payment/status?orderId=${orderId}`);

    if (!response.ok) {
        throw new Error(`Failed to get payment status: ${response.status}`);
    }

    return response.json();
}

export async function getPaymentConfig(): Promise<PaymentConfig> {
    const response = await fetch(`${URL}/payment/config`);

    if (!response.ok) {
        throw new Error(`Failed to get payment config: ${response.status}`);
    }

    return response.json();
}
