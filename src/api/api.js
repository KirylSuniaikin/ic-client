
export var PROD_BASE_HOST = "https://ic-pizza-back.onrender.com/api";
export var DEV_BASE_HOST = "https://leopard-climbing-rooster.ngrok-free.app/api" ;
export const PROD_SOCKET_URL = "https://ic-pizza-back.onrender.com";
export const DEV_SOCKET_URL = "http://localhost8000";


export async function fetchMenu() {
    const response = await fetch(PROD_BASE_HOST + "/getAllMenuItems", {
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

export async function fetchExtraIngredients() {
    const response = await fetch(PROD_BASE_HOST + "/getAllExtraIngr", {
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
        throw new Error("API вернул HTML, а не JSON. Проверь сервер");
    }
    return JSON.parse(text);
}

export async function fetchUserInfo(userId) {
    const url = `${PROD_BASE_HOST}/getUserInfo?userId=${userId}`;
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
        throw new Error("API вернул HTML, а не JSON. Проверь сервер");
    }
    return JSON.parse(text);
}


export async function createOrder(order) {
    console.log(order);
    const response = await fetch(PROD_BASE_HOST + "/createOrder", {
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

export async function markOrderReady(orderId) {
    const url = `${PROD_BASE_HOST}/readyAction?orderId=${orderId}`;

    const response = await fetch(url, {
        method: "POST",
        // headers: {
        //     "ngrok-skip-browser-warning": "69420"
        // }
    });

    if (!response.ok) {
        throw new Error(`Error marking order ready: ${response.status}`);
    }

    return await response.json();
}

export async function editOrder(order, orderId) {
    const url = `${PROD_BASE_HOST}/editOrder?orderId=${orderId}`;

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            // "ngrok-skip-browser-warning": "69420"
        },
        body: JSON.stringify(order)
    });

    if (!response.ok) {
        throw new Error(`Error editing order: ${response.status}`);
    }

    return await response.json();
}

export async function getAllActiveOrders() {
    const response = await fetch(PROD_BASE_HOST + "/getAllActiveOrders", {
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

export async function getHistory() {
    const response = await fetch(PROD_BASE_HOST + "/getHistory", {
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