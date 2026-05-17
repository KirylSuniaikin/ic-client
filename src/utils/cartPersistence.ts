import { PersistedCartData } from "../types/payment";

const CART_KEY = "pendingOnlineOrder";

export function persistCartForRecovery(orderId: number): void {
    const data: PersistedCartData = { orderId, savedAt: Date.now() };
    localStorage.setItem(CART_KEY, JSON.stringify(data));
}

export function clearPersistedCart(): void {
    localStorage.removeItem(CART_KEY);
}

export function getPersistedCart(): PersistedCartData | null {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as PersistedCartData;
    } catch {
        return null;
    }
}
