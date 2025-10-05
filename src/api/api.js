export var PROD_BASE_HOST = "https://icpizza-back.onrender.com/api";
export var DEV_BASE_HOST = "http://localhost:8000/api";
export var PROD_SOCKET_URL = "https://icpizza-back.onrender.com/ws";
export var DEV_SOCKET_URL = "http://localhost:8000/ws";

export var URL = PROD_BASE_HOST;
export var WS_URL = PROD_SOCKET_URL;


export async function fetchBaseAppInfo(userId) {
    let url = URL + "/get_base_app_info";
    if (userId) {
        url += `?userId=${encodeURIComponent(userId)}`;
    }
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
    console.log(order);
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

export async function updateAvailability(changes) {
    console.log("Changes to update:", changes);

    const response = await fetch(URL + "/update_availability", {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            // "ngrok-skip-browser-warning": "69420"
        },
        body: JSON.stringify({ changes })
    });

    if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
    }

    return await response.text();
}

export async function markOrderReady(orderId) {
    const url = `${URL}/ready_action`;
    console.log(orderId);
    const response = await fetch(url, {
        method: "PUT",
        // headers: {
        //     "ngrok-skip-browser-warning": "69420"
        // }
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({ orderId })
    });

    if (!response.ok) {
        throw new Error(`Error marking order ready: ${response.status}`);
    }

    return await response.json();
}

export async function editOrder(order, orderId) {
    const url = `${URL}/edit_order`;

    const response = await fetch(url, {
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

export async function updatePaymentType(orderId, newPaymentType) {
    try {
        const res = await fetch(`${URL}/update_payment_type`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                // "ngrok-skip-browser-warning": "69420"
            },
            body: JSON.stringify({
                order_id: orderId,
                payment_type: newPaymentType
            })
        });

        if (!res.ok) throw new Error(`Error: ${res.status}`);
        const data = await res.json();
        console.log("Payment type updated", data);
    } catch (error) {
        console.error("Failed to update payment type:", error);
    }
}

export async function getAllActiveOrders() {
    const response = await fetch(URL + "/get_all_active_orders", {
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

export async function getHistory() {
    const response = await fetch(URL + "/get_history", {
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
    console.log(text);

    return JSON.parse(text);
}

export async function fetchStatistics(startDate, finishDate, certainDate) {
    const url = `${URL}/get_statistics?start_date=${startDate}&finish_date=${finishDate}&certain_date=${certainDate}`;

    const response = await fetch(url, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            // "ngrok-skip-browser-warning": "69420"
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch statistics: ${response.status}`);
    }

    return await response.json();
}

export async function sendShiftEvent({type, datetime, branch_id, cash_amount = null, prep_plan = null}){
    try {
        const response = await fetch(URL + "/send_shift_event", {

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
            return { error: true, ...data };
        }
        console.log(data);
        return data;
    }
    catch (error) {
        console.error("Failed to sendShiftEvent", error);
    }

}

export async function fetchLastStage(branchId) {
    const url = `${URL}/get_last_stage?branchId=${encodeURIComponent(branchId)}`;
    const response = await fetch(url, {
        method: "GET",
        headers: {
            // "ngrok-skip-browser-warning": "69420"
        }
    });
    if (!response.ok) {
        throw new Error(`Ошибка: ${response.status}`);
    }

    const data = await response.json();
    return data.type || null;
}

export async function deleteOrder(orderId) {
    const url = `${URL}/delete_order?orderId=${encodeURIComponent(orderId)}`;
    const response = await fetch(url, {
        method: "DELETE",
        headers: {
            // "ngrok-skip-browser-warning": "69420"
        }
    });
    if (!response.ok) {
        throw new Error(`Ошибка: ${response.status}`);
    }
}

export async function sendOrderPayment({orderId, amount, type, branchId}){
    try {
        const response = await fetch(URL + "/order_payment", {

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
            return { error: true, ...data };
        }
        console.log(data);
        return data;
    }
    catch (error) {
        console.error("Failed to sendOrderPayment", error);
    }

}

export async function updateOrderStatus({orderId, jahezOrderId, orderStatus, reason}) {
    try{
        console.log(jahezOrderId);
        const response = await fetch(URL + "/status_update", {
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
        } catch {}
        throw new Error(`HTTP ${response.status}${detail}`);
    }
    catch (error) {
        console.error("Failed to update status", error);
    }
}
