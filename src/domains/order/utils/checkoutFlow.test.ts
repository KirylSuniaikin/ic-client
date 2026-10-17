import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import type { CartItem } from "../../menu/types";
import { ApplePayApiError } from "../applePayTypes";
import { CardPaymentApiError } from "../cardPaymentTypes";
import { BranchClosedError, ItemsUnavailableError } from "../types";
import { isDefinitivePayRejection, pollUntilResolved, POLL_INTERVAL_MS, POLL_TIMEOUT_MS, reportCreateOrderFailure } from "./checkoutFlow";
import type { CartFailureHandlers } from "./checkoutFlow";

function item(id: number, name: string): CartItem {
    return {
        id, name, size: "L", category: "Pizza", isThinDough: false, isGarlicCrust: false,
        extraIngredients: [], toppings: [], note: "", quantity: 1, description: "",
        amount: 5, discountAmount: 0, comboItems: null, photo: "",
    };
}

function makeHandlers() {
    const refreshMenu = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);
    const handlers: CartFailureHandlers = {
        t: (key: string) => `t:${key}`,
        setCartItems: jest.fn(),
        setCartOpen: jest.fn(),
        setUnavailableItems: jest.fn(),
        setUnavailableMessage: jest.fn(),
        setUnavailablePopupOpen: jest.fn(),
        refreshMenu,
    };
    return Object.assign(handlers, { refreshMenu });
}

let warnSpy: ReturnType<typeof jest.spyOn>;

beforeEach(() => {
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
    jest.useRealTimers();
    warnSpy.mockRestore();
});

describe("reportCreateOrderFailure", () => {
    const submitted = [item(1, "Margherita"), item(2, "Pepperoni")];

    it("removes unavailable items, reopens the cart with the rest and refreshes the menu", () => {
        const handlers = makeHandlers();
        const report = jest.fn<void, [string]>();

        reportCreateOrderFailure(new ItemsUnavailableError("gone", [2]), submitted, handlers, report, () => false);

        expect(handlers.setCartItems).toHaveBeenCalledWith([submitted[0]]);
        expect(handlers.setCartOpen).toHaveBeenCalledWith(true);
        expect(handlers.setUnavailableItems).toHaveBeenCalledWith(["Pepperoni"]);
        expect(handlers.setUnavailableMessage).toHaveBeenCalledWith("gone");
        expect(handlers.setUnavailablePopupOpen).toHaveBeenCalledWith(true);
        expect(handlers.refreshMenu).toHaveBeenCalledTimes(1);
        expect(report).not.toHaveBeenCalled();
    });

    it("closes the cart when every item is unavailable", () => {
        const handlers = makeHandlers();

        reportCreateOrderFailure(new ItemsUnavailableError("gone", [1, 2]), submitted, handlers, jest.fn(), () => false);

        expect(handlers.setCartItems).toHaveBeenCalledWith([]);
        expect(handlers.setCartOpen).toHaveBeenCalledWith(false);
    });

    it("reports the branch-closed message and refreshes the menu", () => {
        const handlers = makeHandlers();
        const report = jest.fn<void, [string]>();

        reportCreateOrderFailure(new BranchClosedError("closed"), submitted, handlers, report, () => false);

        expect(report).toHaveBeenCalledWith("closed");
        expect(handlers.refreshMenu).toHaveBeenCalledTimes(1);
    });

    it("reports errors.inProgress when the injected predicate matches", () => {
        const handlers = makeHandlers();
        const report = jest.fn<void, [string]>();

        reportCreateOrderFailure(new Error("x"), submitted, handlers, report, () => true);

        expect(report).toHaveBeenCalledWith("t:errors.inProgress");
    });

    it("reports errors.generic otherwise", () => {
        const handlers = makeHandlers();
        const report = jest.fn<void, [string]>();

        reportCreateOrderFailure(new Error("x"), submitted, handlers, report, () => false);

        expect(report).toHaveBeenCalledWith("t:errors.generic");
        expect(handlers.refreshMenu).not.toHaveBeenCalled();
    });

    it("logs a failing menu refresh with the error name only", async () => {
        const handlers = makeHandlers();
        handlers.refreshMenu.mockRejectedValue(new TypeError("secret detail"));

        reportCreateOrderFailure(new BranchClosedError("closed"), submitted, handlers, jest.fn(), () => false);
        await Promise.resolve();
        await Promise.resolve();

        expect(warnSpy).toHaveBeenCalledWith("Menu refresh failed:", "TypeError");
    });
});

describe("isDefinitivePayRejection", () => {
    const codes: ReadonlySet<string> = new Set(["CARD_DECLINED"]);

    it("is true for the given class with a listed code", () => {
        expect(isDefinitivePayRejection(new CardPaymentApiError("CARD_DECLINED", 409), CardPaymentApiError, codes)).toBe(true);
    });

    it("is false for an unlisted code", () => {
        expect(isDefinitivePayRejection(new CardPaymentApiError("OTHER", 500), CardPaymentApiError, codes)).toBe(false);
    });

    it("is false for a different error class even with a listed code", () => {
        expect(isDefinitivePayRejection(new ApplePayApiError("CARD_DECLINED", 409), CardPaymentApiError, codes)).toBe(false);
    });

    it("is false for non-error values", () => {
        expect(isDefinitivePayRejection("CARD_DECLINED", CardPaymentApiError, codes)).toBe(false);
    });
});

describe("pollUntilResolved", () => {
    interface Result { status: string }

    function setup(token: string | null = "tok", mounted = true) {
        const onTimer = jest.fn<void, [ReturnType<typeof setTimeout>]>();
        const fetchStatus = jest.fn<Promise<Result>, [string]>();
        const onResolved = jest.fn<void, [Result]>();
        const onReview = jest.fn<void, []>();
        const onUnresolved = jest.fn<void, []>();
        pollUntilResolved<Result>({
            getToken: () => token,
            isMounted: () => mounted,
            onTimer, fetchStatus, failureLabel: "Test poll failed:", onResolved, onReview, onUnresolved,
        });
        return { fetchStatus, onResolved, onReview, onUnresolved };
    }

    // Jest 27 has no advanceTimersByTimeAsync: step the timers, then let the fetch promise chain settle.
    async function advance(ms: number): Promise<void> {
        let remaining = ms;
        while (remaining > 0) {
            const step = Math.min(remaining, POLL_INTERVAL_MS);
            jest.advanceTimersByTime(step);
            for (let i = 0; i < 5; i++) await Promise.resolve();
            remaining -= step;
        }
    }

    async function tick(): Promise<void> {
        await advance(POLL_INTERVAL_MS);
    }

    beforeEach(() => { jest.useFakeTimers(); });

    it("does not fetch before the first interval", async () => {
        const { fetchStatus } = setup();
        await advance(POLL_INTERVAL_MS - 1);
        expect(fetchStatus).not.toHaveBeenCalled();
    });

    it("keeps polling while PENDING, then resolves on APPROVED with the token", async () => {
        const { fetchStatus, onResolved } = setup();
        fetchStatus.mockResolvedValueOnce({ status: "PENDING" }).mockResolvedValueOnce({ status: "APPROVED" });

        await tick();
        await tick();

        expect(fetchStatus).toHaveBeenCalledTimes(2);
        expect(fetchStatus).toHaveBeenCalledWith("tok");
        expect(onResolved).toHaveBeenCalledWith({ status: "APPROVED" });
    });

    it("resolves on DECLINED", async () => {
        const { fetchStatus, onResolved } = setup();
        fetchStatus.mockResolvedValue({ status: "DECLINED" });

        await tick();

        expect(onResolved).toHaveBeenCalledWith({ status: "DECLINED" });
    });

    it("calls onReview for REVIEW and stops polling", async () => {
        const { fetchStatus, onReview, onResolved } = setup();
        fetchStatus.mockResolvedValue({ status: "REVIEW" });

        await tick();
        await tick();

        expect(onReview).toHaveBeenCalledTimes(1);
        expect(onResolved).not.toHaveBeenCalled();
        expect(fetchStatus).toHaveBeenCalledTimes(1);
    });

    it("logs failures with the caller's label and retries", async () => {
        const { fetchStatus, onResolved } = setup();
        fetchStatus.mockRejectedValueOnce(new CardPaymentApiError("BOOM", 502)).mockResolvedValueOnce({ status: "APPROVED" });

        await tick();
        await tick();

        expect(warnSpy).toHaveBeenCalledWith("Test poll failed:", "BOOM (502)");
        expect(onResolved).toHaveBeenCalledTimes(1);
    });

    it("calls onUnresolved once the deadline passes while still PENDING", async () => {
        const { fetchStatus, onUnresolved } = setup();
        fetchStatus.mockResolvedValue({ status: "PENDING" });

        await advance(POLL_TIMEOUT_MS + POLL_INTERVAL_MS);

        expect(onUnresolved).toHaveBeenCalledTimes(1);
        const calls = fetchStatus.mock.calls.length;
        await advance(POLL_INTERVAL_MS * 3);
        expect(fetchStatus).toHaveBeenCalledTimes(calls);
    });

    it("calls onUnresolved when failures persist past the deadline", async () => {
        const { fetchStatus, onUnresolved } = setup();
        fetchStatus.mockRejectedValue(new Error("down"));

        await advance(POLL_TIMEOUT_MS + POLL_INTERVAL_MS);

        expect(onUnresolved).toHaveBeenCalledTimes(1);
    });

    it("stops silently when there is no token", async () => {
        const { fetchStatus, onResolved, onUnresolved } = setup(null);

        await tick();
        await tick();

        expect(fetchStatus).not.toHaveBeenCalled();
        expect(onResolved).not.toHaveBeenCalled();
        expect(onUnresolved).not.toHaveBeenCalled();
    });

    it("stops silently when unmounted", async () => {
        const { fetchStatus } = setup("tok", false);

        await tick();

        expect(fetchStatus).not.toHaveBeenCalled();
    });
});
