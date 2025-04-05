export async function fetchMenu() {
    const response = await fetch("https://icpizza.pythonanywhere.com/api/getAllMenuItems", {
        method: "GET",
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
    const response = await fetch("https://icpizza.pythonanywhere.com/api/getAllExtraIngr", {
        method: "GET",
    });
    if (!response.ok) {
        throw new Error(`Ошибка: ${response.status}`);
    }

    const data = await response.json();
    return data;
}

export async function createOrder(order) {
    console.log(order);
    const response = await fetch("https://icpizza.pythonanywhere.com/api/createOrder", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(order)
    });


    if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
    }

    return await response.json();
}