import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "../../../shared/i18n";
import { KioskPaymentFailureSheet } from "./KioskPaymentFailureSheet";
import { abandonKioskOrder, deferOrderToCounter } from "../../../shared/api/kiosk";
import { KioskHttpError, KioskUnauthorizedError } from "../../../shared/api/kioskClient";
import { PAYMENT_FAILURE_PROMPT_TIMEOUT_MS } from "../config";

jest.mock("../../../shared/api/kiosk");

const mockDefer = jest.mocked(deferOrderToCounter);
const mockAbandon = jest.mocked(abandonKioskOrder);

function renderSheet(overrides: Partial<Parameters<typeof KioskPaymentFailureSheet>[0]> = {}) {
    const props = {
        open: true,
        orderId: "4321" as string | null,
        onDeferred: jest.fn(),
        onAbandoned: jest.fn(),
        onUnauthorized: jest.fn(),
        ...overrides,
    };
    render(<KioskPaymentFailureSheet {...props} />);
    return props;
}

describe("KioskPaymentFailureSheet", () => {
    beforeEach(() => {
        mockDefer.mockReset();
        mockAbandon.mockReset();
        mockDefer.mockResolvedValue(undefined);
        mockAbandon.mockResolvedValue(undefined);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it("asks the Yes/No question with a countdown", () => {
        renderSheet();

        expect(screen.getByText("Save your order and pay at the front desk?")).toBeTruthy();
        expect(screen.getByRole("button", { name: "Yes, save it" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "No, cancel" })).toBeTruthy();
    });

    it("Yes defers the order to the counter", async () => {
        const props = renderSheet();

        await userEvent.click(screen.getByRole("button", { name: "Yes, save it" }));

        await waitFor(() => expect(mockDefer).toHaveBeenCalledWith("4321"));
        expect(props.onDeferred).toHaveBeenCalledTimes(1);
        expect(mockAbandon).not.toHaveBeenCalled();
    });

    it("No abandons the order", async () => {
        const props = renderSheet();

        await userEvent.click(screen.getByRole("button", { name: "No, cancel" }));

        await waitFor(() => expect(mockAbandon).toHaveBeenCalledWith("4321"));
        expect(props.onAbandoned).toHaveBeenCalledTimes(1);
    });

    it("treats a 404 on abandon as success — the first attempt already landed", async () => {
        mockAbandon.mockRejectedValue(new KioskHttpError(404, "not found"));
        const props = renderSheet();

        await userEvent.click(screen.getByRole("button", { name: "No, cancel" }));

        await waitFor(() => expect(props.onAbandoned).toHaveBeenCalledTimes(1));
        expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    });

    it("routes a 409 on defer to the staff dead end, with no retry", async () => {
        // A late approval landed after the decline: the order is already paid and published, so
        // retrying can only confuse.
        mockDefer.mockRejectedValue(new KioskHttpError(409, "conflict"));
        renderSheet();

        await userEvent.click(screen.getByRole("button", { name: "Yes, save it" }));

        await waitFor(() => expect(screen.getByText("Please see a member of staff")).toBeTruthy());
        expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    });

    it("offers a retry on a non-409 failure, and the retry re-runs the same action", async () => {
        mockDefer.mockRejectedValueOnce(new KioskHttpError(500, "boom"));
        mockDefer.mockResolvedValue(undefined);
        const props = renderSheet();

        await userEvent.click(screen.getByRole("button", { name: "Yes, save it" }));
        await waitFor(() => expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy());

        await userEvent.click(screen.getByRole("button", { name: "Try again" }));

        // Re-invokes defer — it must never re-ask a question the customer already answered.
        await waitFor(() => expect(mockDefer).toHaveBeenCalledTimes(2));
        expect(props.onDeferred).toHaveBeenCalledTimes(1);
        expect(mockAbandon).not.toHaveBeenCalled();
    });

    it("sends an unpaired device to the terminal picker instead of blaming the customer", async () => {
        mockDefer.mockRejectedValue(new KioskUnauthorizedError());
        const props = renderSheet();

        await userEvent.click(screen.getByRole("button", { name: "Yes, save it" }));

        await waitFor(() => expect(props.onUnauthorized).toHaveBeenCalledTimes(1));
    });

    it("abandons exactly once when the countdown expires unanswered", () => {
        jest.useFakeTimers();
        const props = renderSheet();

        act(() => { jest.advanceTimersByTime(PAYMENT_FAILURE_PROMPT_TIMEOUT_MS + 5000); });

        // Silence resolves to discard, never to save.
        expect(mockAbandon).toHaveBeenCalledTimes(1);
        expect(mockAbandon).toHaveBeenCalledWith("4321");
        expect(mockDefer).not.toHaveBeenCalled();
        expect(props.onAbandoned).toHaveBeenCalledTimes(1);
    });

    describe("AMOUNT_MISMATCH", () => {
        it("dead-ends to staff with no Yes/No and no network call", () => {
            renderSheet({ amountMismatch: true });

            expect(screen.getByText("Please see a member of staff")).toBeTruthy();
            expect(screen.queryByRole("button", { name: "Yes, save it" })).toBeNull();
            expect(screen.queryByRole("button", { name: "No, cancel" })).toBeNull();
            expect(mockAbandon).not.toHaveBeenCalled();
            expect(mockDefer).not.toHaveBeenCalled();
        });

        it("never abandons on a timer — money has already left the card", () => {
            jest.useFakeTimers();
            renderSheet({ amountMismatch: true });

            act(() => { jest.advanceTimersByTime(PAYMENT_FAILURE_PROMPT_TIMEOUT_MS * 2); });

            expect(mockAbandon).not.toHaveBeenCalled();
            expect(mockDefer).not.toHaveBeenCalled();
        });
    });

    it("dead-ends without any network call when there is no order id", () => {
        jest.useFakeTimers();
        renderSheet({ orderId: null });

        act(() => { jest.advanceTimersByTime(PAYMENT_FAILURE_PROMPT_TIMEOUT_MS * 2); });

        expect(screen.queryByRole("button", { name: "Yes, save it" })).toBeNull();
        expect(mockAbandon).not.toHaveBeenCalled();
        expect(mockDefer).not.toHaveBeenCalled();
    });
});
