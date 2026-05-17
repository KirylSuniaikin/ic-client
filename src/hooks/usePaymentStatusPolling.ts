import { useEffect, useRef } from "react";
import { PaymentSessionStatus } from "../types/payment";
import { getPaymentStatus } from "../api/paymentApi";

export interface UsePaymentStatusPollingOptions {
    orderId: number | null;
    intervalMs?: number;
    maxAttempts?: number;
    onStatusChange: (status: PaymentSessionStatus) => void;
    onTimeout: () => void;
}

export function usePaymentStatusPolling({
    orderId,
    intervalMs = 2000,
    maxAttempts = 10,
    onStatusChange,
    onTimeout,
}: UsePaymentStatusPollingOptions): void {
    const attempts = useRef(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (orderId === null) return;

        const poll = async (): Promise<void> => {
            if (attempts.current >= maxAttempts) {
                if (timerRef.current) clearInterval(timerRef.current);
                onTimeout();
                return;
            }

            try {
                attempts.current += 1;
                const res = await getPaymentStatus(orderId);
                if (res.status === "PAID" || res.status === "FAILED") {
                    if (timerRef.current) clearInterval(timerRef.current);
                    onStatusChange(res.status);
                }
            } catch (e) {
                console.error("Payment status polling error", e);
            }
        };

        timerRef.current = setInterval(poll, intervalMs);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [orderId, intervalMs, maxAttempts, onStatusChange, onTimeout]);
}
