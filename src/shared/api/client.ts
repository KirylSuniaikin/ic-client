import { logger } from "../utils/logger";
// Served from a host under the storefront's own domain (a CNAME to Render) rather than
// *.onrender.com: that is what makes the customer refresh cookie first-party, so it is
// shared by the apex and www and no longer dropped by Safari's third-party cookie block.
const PROD_BASE_URL = 'https://api.ic-pizza.com/api';
const DEV_BASE_URL = 'http://localhost:8000/api';
const PROD_WS_URL = 'https://api.ic-pizza.com/ws';
const DEV_WS_URL = 'http://localhost:8000/ws';

export const BASE_URL: string = process.env.NODE_ENV === 'production' ? PROD_BASE_URL : DEV_BASE_URL;
export const WS_URL: string = process.env.NODE_ENV === 'production' ? PROD_WS_URL : DEV_WS_URL;

export const DEFAULT_BRANCH_ID = '2e8c35f7-d75e-4442-b496-cbb929842c10';

export async function authFetch(url: string, headersWithoutAuth: RequestInit): Promise<Response> {
    const token = localStorage.getItem("jwt_token");

    const headers = new Headers(headersWithoutAuth?.headers);

    if (token) {
        headers.set("Authorization", "Bearer " + token);
    }

    const response = await fetch(url, {
        ...headersWithoutAuth,
        headers
    });

    if (response.status === 401) {
        logger.warn("Unauthorized");
        localStorage.removeItem("jwt_token");
        window.location.href = "/auth";
        return Promise.reject(new Error("Unauthorized"));
    }

    return response;
}
