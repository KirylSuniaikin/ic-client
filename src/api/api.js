import {authFetch} from "../management/api/api";

export var PROD_BASE_HOST = "https://icpizza-back.onrender.com/api";
export var DEV_BASE_HOST = "http://localhost:8000/api";
export var PROD_SOCKET_URL = "https://icpizza-back.onrender.com/ws";
export var DEV_SOCKET_URL = "http://localhost:8000/ws";

export var URL = PROD_BASE_HOST;
export var WS_URL = PROD_SOCKET_URL;


export async function fetchBaseAppInfo(userId, branchId) {
    let url = URL + "/get_base_app_info";
    const queryParams = new URLSearchParams({
        branchId: '2e8c35f7-d75e-4442-b496-cbb929842c10'
    });

    if (userId) {
        queryParams.append('userId', userId);
    }

    url += `?${queryParams.toString()}`;
    const response = await fetch(url, {
        method: "GET",
        // headers: {
        //     "ngrok-skip-browser-warning": "69420"
        // }
    });
    if (!response.ok) {
        throw new Error(`Ошибка: ${response.status}`);
    }
    const text = await response.text();
    if (text.trim().startsWith("<!DOCTYPE html>")) {
        throw new Error("API вернул HTML, а не JSON. Проверь сервер!");
    }

    return JSON.parse(text);
}

export async function createOrder(order) {
    const response = await fetch(URL + "/create_order", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            // "ngrok-skip-browser-warning": "69420"
        },
        body: JSON.stringify(order)
    });


    if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
    }

    return await response.json();
}

export async function updateAvailability(changes, branchId) {
    const response = await authFetch(URL + "/update_availability", {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            // "ngrok-skip-browser-warning": "69420"
        },
        body: JSON.stringify({changes, branchId}),
    });

    if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
    }

    return await response.text();
}

export async function editOrder(order, orderId) {
    const url = `${URL}/edit_order`;

    const response = await authFetch(url, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            // "ngrok-skip-browser-warning": "69420"
        },
        body: JSON.stringify(order, orderId)
    });

    if (!response.ok) {
        throw new Error(`Error editing order: ${response.status}`);
    }

    return await response.json();
}

export async function getAllActiveOrders(branchId) {
    const response = await authFetch(URL + `/get_all_active_orders?branchId=${branchId}`, {
        method: "GET",
        // headers: {
        //     "ngrok-skip-browser-warning": "69420"
        // }
    });
    if (!response.ok) {
        throw new Error(`Ошибка: ${response.status}`);
    }
    const text = await response.text();
    console.log(text)
    if (text.trim().startsWith("<!DOCTYPE html>")) {
        throw new Error("API вернул HTML, а не JSON. Проверь сервер!");
    }

    return JSON.parse(text);
}

export async function getHistory(branchId) {
    const response = await authFetch(URL + `/get_history?branchId=${branchId}`, {
        method: "GET",
        // headers: {
        //     "ngrok-skip-browser-warning": "69420"
        // }
    });
    if (!response.ok) {
        throw new Error(`Ошибка: ${response.status}`);
    }
    const text = await response.text();
    if (text.trim().startsWith("<!DOCTYPE html>")) {
        throw new Error("API вернул HTML, а не JSON. Проверь сервер!");
    }
    return JSON.parse(text);
}

export async function fetchStatistics(startDate, finishDate, certainDate, branchId) {
    const url = `${URL}/get_statistics?start_date=${startDate}&finish_date=${finishDate}&certain_date=${certainDate}&branchId=${branchId}`;

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

export async function sendShiftEvent({type, datetime, branch_id, cash_amount = null, prep_plan = null}) {
    try {
        const response = await authFetch(URL + "/branch/send_shift_event", {

            method: "POST",
            headers: {
                "Content-Type": "application/json",

                // "ngrok-skip-browser-warning": "69420"
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
        console.log(data);
        return data;
    } catch (error) {
        console.error("Failed to sendShiftEvent", error);
    }

}

export async function deleteOrder(orderId) {
    const url = `${URL}/delete_order?orderId=${encodeURIComponent(orderId)}`;
    const response = await authFetch(url, {
        method: "DELETE",
        headers: {
            // "ngrok-skip-browser-warning": "69420"
        }
    });
    if (!response.ok) {
        throw new Error(`Ошибка: ${response.status}`);
    }
}

export async function sendOrderPayment({orderId, amount, type, branchId}) {
    try {
        const response = await authFetch(URL + "/order_payment", {

            method: "POST",
            headers: {
                "Content-Type": "application/json",
                // "ngrok-skip-browser-warning": "69420"
            },
            body: JSON.stringify({
                orderId,
                amount,
                type,
                branchId
            })
        });
        const data = await response.json();

        if (!response.ok) {
            return {error: true, ...data};
        }
        console.log(data);
        return data;
    } catch (error) {
        console.error("Failed to sendOrderPayment", error);
    }

}

export async function updateOrderStatus({orderId, jahezOrderId, orderStatus, reason}) {
    try {
        console.log(jahezOrderId);
        const response = await authFetch(URL + "/status_update", {
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
        });

        if (response.ok) return;

        let detail = "";
        try {
            const t = await response.text();
            if (t) detail = ` – ${t}`;
        } catch {
        }
        throw new Error(`HTTP ${response.status}${detail}`);
    } catch (error) {
        console.error("Failed to update status", error);
    }
}

export async function getOrderStatus(orderId) {
    try {
        const response = await authFetch(URL + "/order_status?order_id=" + orderId, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            }
        })
        if (!response.ok) {
            const data = await response.json();
            return {error: true, message: data.message || "Order not found"};
        }
        return await response.json();
    } catch (error) {
        console.error("Failed to get order", error);
        return {error: true, message: "Connection error"};
    }
}

export async function updateWorkload({branchId, newLevel}) {
    try {
        await authFetch(URL + "/branch/update_workload_level", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                branchId: branchId,
                level: newLevel
            })
        })

    } catch (e) {
        console.error("Failed to update workload", e);
    }
}

export async function getBaseAdminInfo(branchId) {
    try {
        const response = await authFetch(URL + "/branch/get_admin_base_info?branchId=" + branchId, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            }
        })

        return await response.json();
    } catch (error) {
        console.error("Failed to get base admin info", error);
    }
}

export async function checkCustomer(telephoneNumber) {
    try {
        const response = await fetch(URL + "/check_customer?tel=" + telephoneNumber, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            }
        })

        return await response.json();
    } catch (error) {
        console.error("Failed to check customer", error);
    }
}