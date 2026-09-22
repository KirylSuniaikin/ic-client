/**
 * Payment-result types for the BENEFIT Payment Gateway hosted checkout.
 *
 * Mirrors the backend `BpgPaymentResultTO`. The customer reaches this flow by being redirected
 * away to BENEFIT's own page and then back, so nothing here is derived from the redirect's query
 * string except the opaque reference — the outcome itself is always read from our own API.
 */

/** The backend `PaymentStatus` state machine, verbatim. */
export type PaymentStatus =
    | "INITIATING"
    | "PENDING"
    | "APPROVED"
    | "DECLINED"
    | "CANCELLED"
    | "EXPIRED"
    | "AMOUNT_MISMATCH"
    | "ERROR";

/**
 * States the customer never has to wait out. Polling stops as soon as one is seen.
 *
 * `INITIATING` and `PENDING` are deliberately absent: the browser routinely arrives back here
 * before the server-to-server notification has been applied, so "not settled yet" is the normal
 * first answer rather than a failure.
 */
const TERMINAL_STATUSES: readonly PaymentStatus[] = [
    "APPROVED",
    "DECLINED",
    "CANCELLED",
    "EXPIRED",
    "AMOUNT_MISMATCH",
    "ERROR",
];

export function isTerminalStatus(status: PaymentStatus): boolean {
    return TERMINAL_STATUSES.includes(status);
}

/**
 * `AMOUNT_MISMATCH` means the customer was charged less than the order costs. Money has already
 * left their card, so a retry would take a second payment for an order that still is not covered —
 * the kiosk sends these to a member of staff for exactly this reason, and so do we.
 */
export function isRetryable(status: PaymentStatus): boolean {
    return status === "DECLINED" || status === "EXPIRED" || status === "ERROR" || status === "CANCELLED";
}

/**
 * Mirrors the backend `BpgPaymentResultTO`.
 *
 * Note what is absent: `orders.id`. The kiosk's own DTO records why — showing the database id
 * meant "the customer walked to the counter quoting a number nobody else could find". `orderNo`
 * is the only order number a human ever sees.
 */
export type BpgPaymentResult = {
    /** Echoed back so the page can keep polling. */
    reference: string;
    status: PaymentStatus;
    /** The 1-9999 ticket number. Null only while the attempt has no order attached. */
    orderNo: number | null;
    /** What was charged, falling back to what was requested while the attempt is still live. */
    amount: string | null;
    /** Masked PAN as the gateway returned it — never a full number. */
    cardNo: string | null;
    /** Retrieval reference number: what a bank asks for in a dispute. */
    rrn: string | null;
    authCode: string | null;
    failureReason: string | null;
};

/**
 * Mirrors the backend `BpgRetryResultTO`.
 *
 * The reference is a NEW one — the previous attempt stays terminal forever, so a page that keeps
 * polling the old reference would sit watching the decline it just retried out of.
 */
export type BpgRetryResult = {
    reference: string;
    redirectUrl: string;
};

/**
 * Mirrors the backend `BpgCheckoutResultTO` — the 201 body of
 * `POST /payments/bpg/checkout`, the pay-online route for a PICKUP order.
 *
 * The order EXISTS but is NOT paid when this comes back: it is created `Pending Payment` and the
 * customer still has to settle it on the gateway's page. Ignoring `redirectUrl` would leave them
 * believing an unpaid order was placed.
 */
export type BpgCheckoutResult = {
    /** The customer-facing ticket number — never `orders.id`. */
    orderNo: number;
    /** Always `"Pending Payment"` on a 201; a field rather than an assumption. */
    status: string;
    /** The attempt reference, for polling the result page. */
    reference: string;
    /** Where the customer must be sent to pay. */
    redirectUrl: string;
};

/**
 * Mirrors the backend `BenefitPaySessionTO` — what the browser needs to open the wallet widget.
 *
 * Note what is absent: the secret token. `InApp.min.js` computes nothing, so the finished
 * `secureHash` travels instead and the secret never leaves the server.
 */
export type BenefitPaySession = {
    /** The customer-facing ticket number — never `orders.id`. */
    orderNo: number;
    /** Always `"Pending Payment"` on a 201. */
    status: string;
    /** Per-attempt reference. Polled for the result, and what check-status is asked about. */
    reference: string;
    merchantId: string;
    appId: string;
    /** BHD, three decimals. */
    amount: string;
    /** Numeric ISO code — `048` for BHD. */
    currency: string;
    secureHash: string;
    qrTimeoutMs: number;
};
