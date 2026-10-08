import { logger } from "../utils/logger";
import { authFetch, BASE_URL, DEFAULT_BRANCH_ID, DEFAULT_RETRY_DELAYS_MS, fetchWithRetryPolicy, reportIfServerError, reportNetworkError } from './client';
import { applyClientPlatform } from './clientPlatform';
import { imageMap, mapOrderImages, mapOrdersImages } from '../utils/imageMap';
import type {
    BaseAppInfoResponse,
    Items409Response,
    Order,
    AvailabilityChange,
    ShiftEventPayload,
    OrderPaymentPayload,
    UpdateOrderStatusPayload,
    AdminBaseInfo,
    WorkloadLevel,
    CreateOrderRequest,
    EditOrderRequest,
    GetHistoryParams,
    GetHistoryResponse,
} from '../../domains/order/types';
import type { OrderStatusData } from '../../domains/order-status/types';
import type { ShiftEventResponse } from '../types/EventTypes';
import type { DoughInventoryAmounts } from '../../domains/management/dough/types';
import { ItemsUnavailableError, BranchClosedError, OrderPaymentError } from '../../domains/order/types';
import type { BranchClosedResponse } from '../../domains/order/types';
import type { StatsResponse } from '../../domains/management/statistics/types';

export async function fetchBaseAppInfo(
    userId: string | null,
    branchId: string
): Promise<BaseAppInfoResponse> {
    let url = BASE_URL + "/get_base_app_info";
    const queryParams = new URLSearchParams({
        branchId: branchId || DEFAULT_BRANCH_ID
    });

    if (userId) {
        queryParams.append('userId', userId);
    }

    url += `?${queryParams.toString()}`;

    const headers = new Headers();
    applyClientPlatform(headers);

    let response: Response;
    try {
        response = await fetchWithRetryPolicy(url, {
            method: "GET",
            headers,
        }, DEFAULT_RETRY_DELAYS_MS);
    } catch (error) {
        // Fire-and-forget: telemetry must never delay the order path's error handling. Only
        // reported once, after every retry has already failed.
        void reportNetworkError(error, url, "GET");
        throw error;
    }

    void reportIfServerError(response, url, "GET");


    if (!response.ok) {
        throw new Error(`Ошибка: ${response.status}`);
    }
    const text = await response.text();
    if (text.trim().startsWith("<!DOCTYPE html>")) {
        throw new Error("API вернул HTML, а не JSON. Проверь сервер!");
    }

    const data = JSON.parse(text);

    if (data.menu) {
        data.menu = data.menu.map((item: BaseAppInfoResponse['menu'][number]) => ({
            ...item,
            photo: imageMap[item.name] || item.photo
        }));
    }

    return data;
}

export async function createOrder(order: CreateOrderRequest): Promise<Order> {
    const response = await authFetch(BASE_URL + "/create_order", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(order)
    });

    if (response.status === 423) {
        const body = await response.json() as BranchClosedResponse;
        throw new BranchClosedError(body.message);
    }

    if (response.status === 409) {
        const body = await response.json() as Items409Response;
        throw new ItemsUnavailableError(body.message, body.unavailableIds);
    }

    if (!response.ok) {
        let errorMessage = "Something went wrong placing an order.";

        try {
            const errorData = await response.json();

            if (errorData && errorData.message) {
                errorMessage = errorData.message;
            }
        } catch (e) {
            const textError = await response.text();
            if (textError) errorMessage = textError;
        }

        throw new Error(errorMessage);
    }

    return await response.json();
}

export async function updateAvailability(
    changes: AvailabilityChange[],
    branchId: string,
    doughInventory?: DoughInventoryAmounts
): Promise<string> {
    const response = await authFetch(BASE_URL + "/update_availability", {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({changes, branchId, doughInventory: doughInventory ?? null}),
    });

    if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
    }

    return await response.text();
}

export async function editOrder(order: EditOrderRequest, orderId: string): Promise<Order> {
    const url = `${BASE_URL}/edit_order`;

    const response = await authFetch(url, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
        },
        // orderId is passed as replacer argument — this matches the original JS runtime behaviour
        body: JSON.stringify(order, orderId as unknown as (string | number)[])
    });

    if (!response.ok) {
        throw new Error(`Error editing order: ${response.status}`);
    }

    return await response.json();
}

export async function getAllActiveOrders(branchId: string): Promise<Order[]> {
    const response = await authFetch(BASE_URL + `/get_all_active_orders?branchId=${branchId}`, {
        method: "GET",
    });
    if (!response.ok) {
        throw new Error(`Ошибка: ${response.status}`);
    }
    const text = await response.text();
    if (text.trim().startsWith("<!DOCTYPE html>")) {
        throw new Error("API вернул HTML, а не JSON. Проверь сервер!");
    }

    return mapOrdersImages(JSON.parse(text));
}

export async function getHistory(params: GetHistoryParams): Promise<GetHistoryResponse> {
    const { branchId, page, size, filter } = params;

    const queryParams = new URLSearchParams({
        branchId,
        page: String(page),
    });

    if (size !== undefined) {
        queryParams.append('size', String(size));
    }

    if (filter && filter.type !== 'none') {
        queryParams.append(filter.type, String(filter.value));
    }

    const response = await authFetch(BASE_URL + `/get_history?${queryParams.toString()}`, {
        method: "GET",
    });
    if (!response.ok) {
        throw new Error(`Ошибка: ${response.status}`);
    }
    const text = await response.text();
    if (text.trim().startsWith("<!DOCTYPE html>")) {
        throw new Error("API вернул HTML, а не JSON. Проверь сервер!");
    }
    const body: GetHistoryResponse = JSON.parse(text);
    return { orders: mapOrdersImages(body.orders), hasMore: body.hasMore };
}

export async function fetchStatistics(
    startDate: string,
    finishDate: string,
    certainDate: string,
    branchId: string
): Promise<StatsResponse> {
    const url = `${BASE_URL}/get_statistics?start_date=${startDate}&finish_date=${finishDate}&certain_date=${certainDate}&branchId=${branchId}`;

    const response = await authFetch(url, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch statistics: ${response.status}`);
    }

    return await response.json();
}

export async function sendShiftEvent(payload: ShiftEventPayload): Promise<ShiftEventResponse | undefined> {
    const {type, datetime, branch_id, cash_amount = null, prep_plan = null} = payload;
    try {
        const response = await authFetch(BASE_URL + "/branch/send_shift_event", {

            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                type,
                datetime,
                branch_id,
                cash_amount,
                prep_plan
            })
        });
        const data = await response.json();

        if (!response.ok) {
            return {error: true, ...data};
        }
        return data;
    } catch (error) {
        logger.error("Failed to sendShiftEvent", error);
    }
}

export async function deleteOrder(orderId: string): Promise<void> {
    const url = `${BASE_URL}/delete_order?orderId=${encodeURIComponent(orderId)}`;
    const response = await authFetch(url, {
        method: "DELETE",
    });
    if (!response.ok) {
        throw new Error(`Ошибка: ${response.status}`);
    }
}

async function readPaymentErrorMessage(response: Response, status: number): Promise<string> {
    const fallback = `Payment failed (HTTP ${status})`;
    try {
        const body: unknown = await response.json();
        if (typeof body === "object" && body !== null && "message" in body && typeof body.message === "string") {
            return body.message;
        }
    } catch {
        // Non-JSON error body (e.g. a gateway HTML page): the status-based message is enough.
    }
    return fallback;
}

// Rejects on any failure so the caller can keep the payment popup open; re-submitting with the
// same idempotency_key is safe.
export async function sendOrderPayment(payload: OrderPaymentPayload): Promise<unknown> {
    const {orderId, amount, type, branchId, idempotency_key} = payload;
    const response = await authFetch(
        BASE_URL + "/order_payment",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                orderId,
                amount,
                type,
                branchId,
                idempotency_key
            }),
        },
        // Never retry a keyless payment: a replay would double-apply.
        idempotency_key ? {retryDelaysMs: DEFAULT_RETRY_DELAYS_MS} : undefined
    );

    if (!response.ok) {
        throw new OrderPaymentError(await readPaymentErrorMessage(response, response.status), response.status);
    }
    return response.json();
}

// Retries a transient network blip (see AuthFetchOptions.retryDelaysMs). Safe to retry: a
// PreResponseNetworkError means the request never reached the server, and setting an order's
// status to the same value twice is idempotent — unlike order CREATION, which already has its
// own dedicated idempotency-key mechanism precisely because blindly retrying that would risk a
// duplicate order.
const STATUS_UPDATE_RETRY_DELAYS_MS = [500, 1500];

export async function updateOrderStatus(payload: UpdateOrderStatusPayload): Promise<void> {
    const {orderId, jahezOrderId, orderStatus, reason} = payload;
    try {
        const response = await authFetch(
            BASE_URL + "/status_update",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    orderId,
                    jahezOrderId,
                    orderStatus,
                    reason
                })
            },
            { retryDelaysMs: STATUS_UPDATE_RETRY_DELAYS_MS }
        );

        if (response.ok) return;

        let detail = "";
        try {
            const t = await response.text();
            if (t) detail = ` – ${t}`;
        } catch {
        }
        throw new Error(`HTTP ${response.status}${detail}`);
    } catch (error) {
        logger.error("Failed to update status", error);
    }
}

export async function getOrderStatus(orderId: string): Promise<OrderStatusData | { error: true; message: string }> {
    try {
        const response = await authFetch(BASE_URL + "/order_status?order_id=" + orderId, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            }
        });
        if (!response.ok) {
            const data = await response.json();
            return {error: true, message: data.message || "Order not found"};
        }
        // OrderStatusData has no items array; mapOrderImages is a no-op here — cast is safe
        return mapOrderImages(await response.json() as unknown as Order) as unknown as OrderStatusData;
    } catch (error) {
        logger.error("Failed to get order", error);
        return {error: true, message: "Connection error"};
    }
}

export async function updateWorkload(params: { branchId: string; newLevel: WorkloadLevel }): Promise<void> {
    const {branchId, newLevel} = params;
    try {
        await authFetch(BASE_URL + "/branch/update_workload_level", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                branchId: branchId,
                level: newLevel
            })
        });

    } catch (e) {
        logger.error("Failed to update workload", e);
    }
}

export async function getBaseAdminInfo(branchId: string): Promise<AdminBaseInfo | undefined> {
    try {
        const response = await authFetch(BASE_URL + "/branch/get_admin_base_info?branchId=" + branchId, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            }
        });

        return await response.json();
    } catch (error) {
        logger.error("Failed to get base admin info", error);
    }
}
