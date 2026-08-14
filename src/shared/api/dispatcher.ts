// Manager dispatcher endpoints (DELIVERY_SPEC.md §4). Staff-authenticated, so these go through
// authFetch like the rest of shared/api/management.ts rather than the customer-token helpers.
import { BASE_URL, authFetch } from './client';
import type {
    CourierOrderSummary,
    CourierStats,
    OrderRoute,
    UnassignedOrder,
} from '../../domains/management/couriers/types';

const BASE = `${BASE_URL}/management/delivery`;

export async function fetchCouriers(): Promise<CourierStats[]> {
    const res = await authFetch(`${BASE}/couriers`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}

/** §2.3's queue: delivery orders still waiting for a courier. */
export async function fetchOrdersAwaitingCourier(): Promise<UnassignedOrder[]> {
    const res = await authFetch(`${BASE}/orders/awaiting-courier`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}

export async function fetchCourierOrders(courierId: string): Promise<CourierOrderSummary[]> {
    const res = await authFetch(`${BASE}/couriers/${courierId}/orders`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}

export async function fetchOrderRoute(orderId: number): Promise<OrderRoute> {
    const res = await authFetch(`${BASE}/orders/${orderId}/route`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}

/** §2.3's escape hatch: assign a specific courier once the queue has been exhausted. */
export async function manualAssign(orderId: number, courierId: string): Promise<void> {
    const res = await authFetch(`${BASE}/orders/${orderId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courierId }),
    });
    if (!res.ok) throw new Error(`Response: ${res.status}`);
}
