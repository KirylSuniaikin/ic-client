import { BASE_URL } from "./client";
import { kioskFetch, KioskHttpError } from "./kioskClient";
import type { CreateOrderRequest, Order, Items409Response, BranchClosedResponse } from "../../domains/order/types";
import { ItemsUnavailableError, BranchClosedError } from "../../domains/order/types";

const KIOSK_BASE = `${BASE_URL}/kiosk`;

// Mirrors backend PaymentStatus (eazypay-integration:src/main/java/com/icpizza/backend/domain/
// kiosk/enums/PaymentStatus.java). Terminal states per that enum's own isTerminal(): every value
// except INITIATING/PENDING.
export type PaymentStatus =
    | "INITIATING"
    | "PENDING"
    | "APPROVED"
    | "DECLINED"
    | "CANCELLED"
    | "EXPIRED"
    | "AMOUNT_MISMATCH"
    | "ERROR";

// Mirrors backend KioskAdminDTOs.KioskPairingOptionTO (deviceName, terminalId, branchId: UUID
// (serialises as string), branchName). Not branch-filtered by the backend — callers filter by the
// branch already stored locally (kioskBranch.ts).
export type PairingKiosk = {
    deviceName: string;
    terminalId: string;
    branchId: string;
    branchName: string;
};

// Mirrors backend PaymentDTOs.PaymentInitiatedTO(String invoiceNum, PaymentStatus status).
export type InitiatePaymentResponse = {
    invoiceNum: string;
    status: PaymentStatus;
};

/**
 * Mirrors backend PaymentDTOs.PaymentResultTO field-for-field (verified by reading
 * eazypay-integration:src/main/java/com/icpizza/backend/domain/kiosk/dto/PaymentDTOs.java — see
 * task-spec.md §5 Open Question / §22 item 1). All fields beyond `invoiceNum`/`status`/`orderId`/
 * `amount` are nullable on the backend record — most stay unset until EazyPay actually settles.
 */
export type PaymentResultResponse = {
    invoiceNum: string;
    status: PaymentStatus;
    orderId: number;
    amount: string;
    cardNo: string | null;
    trnRrn: string | null;
    trnAuthCode: string | null;
    trnCcy: string | null;
    posEntryMode: string | null;
    dccMarkup: string | null;
    dccRate: string | null;
    dccAmount: string | null;
    dccCurrency: string | null;
    dccCurrencyEx: string | null;
    dccMsg: string | null;
    failureReason: string | null;
};

/**
 * The `/kiosk/pairing/kiosks` list couldn't be fetched or parsed — most commonly because the
 * `eazypay-integration` backend branch isn't deployed yet (a stale deploy 404s the whole `/kiosk`
 * prefix) or the device's stored pairing was revoked (401/403). Rendered on-screen by
 * `KioskTerminalPicker` (Phase 5) instead of a silent blank screen, per task-spec.md §11 Risks.
 */
export class PairingUnavailableError extends Error {
    constructor(message = "Pairing options are unavailable right now.") {
        super(message);
        this.name = "PairingUnavailableError";
    }
}

/**
 * Narrows an `unknown` HTTP response body to `Items409Response` before trusting it — the body
 * came off the wire (`KioskHttpError.body`), not from an untyped library, but the same
 * don't-trust-external-data reasoning applies: every field is checked individually rather than
 * cast wholesale.
 */
function asItems409Response(body: unknown): Items409Response | null {
    if (typeof body !== "object" || body === null) return null;
    const record = body as Record<string, unknown>;
    const { message, unavailableIds } = record;
    if (typeof message !== "string" || !Array.isArray(unavailableIds)) return null;
    if (!unavailableIds.every((id): id is number => typeof id === "number")) return null;
    return { message, unavailableIds };
}

/** Same reasoning as {@link asItems409Response}, for the 423 branch-closed body. */
function asBranchClosedResponse(body: unknown): BranchClosedResponse | null {
    if (typeof body !== "object" || body === null) return null;
    const record = body as Record<string, unknown>;
    if (typeof record.message !== "string") return null;
    return { message: record.message };
}

/**
 * Every active, named kiosk, for the terminal picker's branch-filtered list (client-side
 * filtering — see `KioskTerminalPicker`, Phase 5).
 *
 * Deliberately uses raw `fetch`, not `kioskFetch`: this is the one `permitAll` route under
 * `/api/kiosk/**` (`KioskPairingController`), called by a device before it has an identity, or
 * while re-pairing to a different terminal — sending a stale `X-Kiosk-Name` here would be
 * misleading even though the backend does not currently gate this route on the header at all.
 * `kioskFetch`'s 401-only special-casing would also be wrong here: 401/403/404 must all become
 * the same diagnosable `PairingUnavailableError`, since a 404 most commonly means the
 * `eazypay-integration` backend branch simply isn't deployed to this environment yet.
 */
export async function fetchPairingOptions(): Promise<PairingKiosk[]> {
    const response = await fetch(`${KIOSK_BASE}/pairing/kiosks`, { method: "GET" });

    if (response.status === 401 || response.status === 403 || response.status === 404) {
        throw new PairingUnavailableError();
    }

    if (!response.ok) {
        throw new Error(`Failed to fetch pairing options: ${response.status}`);
    }

    return await response.json();
}

/**
 * Creates an unpaid ("Pending Payment") kiosk order. Follows `public.ts`'s `createOrder` throwing
 * style: a 409 (items went unavailable between cart and submit) becomes `ItemsUnavailableError`
 * carrying `unavailableIds`; a 423 (branch closed) becomes `BranchClosedError`. Both are re-derived
 * from `KioskHttpError.body` rather than relying on `kioskFetch`'s generic message string, because
 * the cart-splitting flow (`useKioskCheckout`, Phase 4) needs the structured `unavailableIds` list,
 * not just a message.
 */
export async function createKioskOrder(order: CreateOrderRequest): Promise<Order> {
    let response: Response;
    try {
        response = await kioskFetch(`${KIOSK_BASE}/orders`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(order),
        });
    } catch (err) {
        if (err instanceof KioskHttpError) {
            if (err.status === 409) {
                const items409 = asItems409Response(err.body);
                throw new ItemsUnavailableError(items409?.message ?? err.message, items409?.unavailableIds ?? []);
            }
            if (err.status === 423) {
                const branchClosed = asBranchClosedResponse(err.body);
                throw new BranchClosedError(branchClosed?.message ?? err.message);
            }
        }
        throw err;
    }

    return await response.json();
}

/**
 * Pushes the order's total to this device's paired terminal. The device sends only the order id —
 * the amount and terminal are resolved server-side. Idempotent per order on the backend, so a
 * retry after a network hiccup is safe to call again.
 */
export async function initiateKioskPayment(orderId: string): Promise<InitiatePaymentResponse> {
    const response = await kioskFetch(`${KIOSK_BASE}/payments/initiate`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        // Backend's InitiatePaymentTO.orderId is a Long; sent as a JSON number (not a quoted
        // string) so the request body's shape doesn't depend on Jackson's scalar-coercion config.
        body: JSON.stringify({ orderId: Number(orderId) }),
    });

    return await response.json();
}

/** Polled by `useKioskPaymentPolling` (Phase 3) while the customer is at the terminal. */
export async function fetchKioskPaymentResult(invoiceNum: string): Promise<PaymentResultResponse> {
    const response = await kioskFetch(`${KIOSK_BASE}/payments/${encodeURIComponent(invoiceNum)}/result`, {
        method: "GET",
    });

    return await response.json();
}

/** Aborts a payment the terminal is still waiting on — kiosk timeout or customer walk-away. */
export async function cancelKioskPayment(invoiceNum: string): Promise<void> {
    await kioskFetch(`${KIOSK_BASE}/payments/${encodeURIComponent(invoiceNum)}/cancel`, {
        method: "POST",
    });
}

/**
 * The customer declined to retry the card and chose to pay at the counter instead. Idempotent on
 * the backend. A 409 here means a late card approval landed after the decline (the order is
 * already paid/published elsewhere) — surfaces as `KioskHttpError(409, ...)` for the caller
 * (`useKioskCheckout`'s failure-sheet routing, Phase 4) to route to the `error-terminal` dead end
 * rather than retry.
 */
export async function deferOrderToCounter(orderId: string): Promise<void> {
    await kioskFetch(`${KIOSK_BASE}/orders/${encodeURIComponent(orderId)}/defer-to-counter`, {
        method: "POST",
    });
}

/**
 * The customer declined to retry the card and chose not to place the order at all. Hard-deletes
 * the unpaid order. **Not idempotent** — a second call 404s, which surfaces as
 * `KioskHttpError(404, ...)`; the caller treats that specific case as success (task-spec.md §11 —
 * do not "fix" this by retrying harder).
 */
export async function abandonKioskOrder(orderId: string): Promise<void> {
    await kioskFetch(`${KIOSK_BASE}/orders/${encodeURIComponent(orderId)}/abandon`, {
        method: "POST",
    });
}
