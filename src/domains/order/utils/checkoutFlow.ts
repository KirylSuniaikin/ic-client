import type { Dispatch, SetStateAction } from "react";
import { logger } from "../../../shared/utils/logger";
import type { CartItem } from "../../menu/types";
import { BranchClosedError, ItemsUnavailableError } from "../types";
import { ApplePayApiError } from "../applePayTypes";
import { CardPaymentApiError } from "../cardPaymentTypes";

export const POLL_INTERVAL_MS = 3000;
// Must outlast the backend's NOT_FOUND grace window (default 120 s): after a PAY timeout the
// attempt can legitimately stay PENDING that long before it resolves to paid or declined.
export const POLL_TIMEOUT_MS = 150000;

// Error codes/statuses only -- never the token or any payment data.
export function describeError(error: unknown): string {
    if (error instanceof ApplePayApiError || error instanceof CardPaymentApiError) {
        return `${error.code} (${error.status})`;
    }
    return error instanceof Error ? error.name : "unknown";
}

// Failure/poll plumbing shared by the Apple Pay and card checkouts. Everything provider-specific
// (error class, codes, fetcher, log label) is injected so neither hook's behaviour changes.

export interface CartFailureHandlers {
    t: (key: string) => string;
    setCartItems: Dispatch<SetStateAction<CartItem[]>>;
    setCartOpen: Dispatch<SetStateAction<boolean>>;
    setUnavailableItems: Dispatch<SetStateAction<string[]>>;
    setUnavailableMessage: Dispatch<SetStateAction<string | null>>;
    setUnavailablePopupOpen: Dispatch<SetStateAction<boolean>>;
    refreshMenu: () => Promise<void>;
}

function refreshMenuLogged(handlers: CartFailureHandlers): void {
    handlers.refreshMenu().catch((e: unknown) => logger.warn("Menu refresh failed:", describeError(e)));
}

function applyItemsUnavailable(failure: ItemsUnavailableError, submitted: CartItem[], handlers: CartFailureHandlers): void {
    const removed = submitted.filter(item => failure.unavailableIds.includes(item.id));
    const remaining = submitted.filter(item => !failure.unavailableIds.includes(item.id));
    handlers.setCartItems(remaining);
    handlers.setCartOpen(remaining.length > 0);
    handlers.setUnavailableItems(removed.map(i => i.name));
    handlers.setUnavailableMessage(failure.message);
    handlers.setUnavailablePopupOpen(true);
    refreshMenuLogged(handlers);
}

export function reportCreateOrderFailure(
    failure: unknown,
    submitted: CartItem[],
    handlers: CartFailureHandlers,
    report: (message: string) => void,
    isInProgress: (failure: unknown) => boolean,
): void {
    if (failure instanceof ItemsUnavailableError) {
        applyItemsUnavailable(failure, submitted, handlers);
    } else if (failure instanceof BranchClosedError) {
        report(failure.message);
        refreshMenuLogged(handlers);
    } else if (isInProgress(failure)) {
        report(handlers.t("errors.inProgress"));
    } else {
        report(handlers.t("errors.generic"));
    }
}

interface PollParams<R extends { status: string }> {
    // Null once the customer has no token; the poll then stops silently, as before.
    getToken: () => string | null;
    isMounted: () => boolean;
    // Hands each scheduled timer back so the owning hook can clear the latest one on unmount.
    onTimer: (timer: ReturnType<typeof setTimeout>) => void;
    fetchStatus: (accessToken: string) => Promise<R>;
    failureLabel: string;
    onResolved: (result: R) => void;
    onReview: () => void;
    onUnresolved: () => void;
}

// Polls until the payment resolves. The caller keeps its busy flag set throughout and after a
// timeout, so the button remains blocked this page session (the server guard covers reloads).
export function pollUntilResolved<R extends { status: string }>(params: PollParams<R>): void {
    const { getToken, isMounted, onTimer, fetchStatus, failureLabel, onResolved, onReview, onUnresolved } = params;
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    const tick = (): void => {
        onTimer(setTimeout(() => {
            const accessToken = getToken();
            if (!isMounted() || !accessToken) return;
            fetchStatus(accessToken)
                .then(result => {
                    if (result.status === "PENDING") {
                        if (Date.now() < deadline) tick();
                        else onUnresolved();
                    } else if (result.status === "APPROVED" || result.status === "DECLINED") {
                        onResolved(result);
                    } else if (result.status === "REVIEW") {
                        onReview();
                    }
                })
                .catch((e: unknown) => {
                    logger.warn(failureLabel, describeError(e));
                    if (Date.now() < deadline) tick();
                    else onUnresolved();
                });
        }, POLL_INTERVAL_MS));
    };
    tick();
}

export function isDefinitivePayRejection<E extends { code: string }>(
    failure: unknown,
    errorClass: new (...args: never[]) => E,
    definitiveCodes: ReadonlySet<string>,
): boolean {
    return failure instanceof errorClass && definitiveCodes.has(failure.code);
}
