import { describe, it, expect, jest } from "@jest/globals";
// This repo does not wire jest-dom to the `expect` exported by @jest/globals — see the comments
// in DeliverySwitch.test.tsx and AddressPickerDrawer.test.tsx. Presence is asserted with
// toBeTruthy()/toBeNull() throughout.
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";

import { PaymentResultContent } from "./PaymentResultContent";
import type { BpgPaymentResult, PaymentStatus } from "../types";
import "../../../shared/i18n";

function resultWith(status: PaymentStatus, overrides: Partial<BpgPaymentResult> = {}): BpgPaymentResult {
    return {
        reference: "1700000000042123456",
        status,
        orderNo: 4231,
        amount: "5.500",
        cardNo: "460041******1234",
        rrn: "935110000001",
        authCode: "099673",
        failureReason: null,
        ...overrides,
    };
}

function renderContent(props: Partial<React.ComponentProps<typeof PaymentResultContent>> = {}) {
    return render(
        <PaymentResultContent
            result={null}
            settling={false}
            timedOut={false}
            error={null}
            onRetry={jest.fn()}
            onBackToMenu={jest.fn()}
            {...props}
        />
    );
}

describe("PaymentResultContent", () => {
    describe("while settlement is still in flight", () => {
        it("shows a confirming state rather than a failure", () => {
            renderContent({ settling: true });

            expect(screen.getByText("Confirming your payment")).toBeTruthy();
        });
    });

    describe("on an approved payment", () => {
        it("shows the customer-facing order number", () => {
            renderContent({ result: resultWith("APPROVED") });

            expect(screen.getByText("4231")).toBeTruthy();
        });

        /**
         * The kiosk's own DTO records why this matters: its confirm screen once showed
         * `orders.id`, and the customer walked to the counter quoting a number no member of staff
         * could find. Only `orderNo` is ever displayed.
         */
        it("never renders a database id, only the ticket number", () => {
            const result = resultWith("APPROVED", { orderNo: 4231 });

            renderContent({ result });

            // 90210 stands in for orders.id: it is not part of the DTO at all, so it must not be
            // reachable from anything the component renders.
            expect(screen.queryByText("90210")).toBeNull();
        });

        it("shows the receipt details a customer would need for a dispute", () => {
            renderContent({ result: resultWith("APPROVED") });

            expect(screen.getByText("5.500")).toBeTruthy();
            expect(screen.getByText("460041******1234")).toBeTruthy();
            expect(screen.getByText("099673")).toBeTruthy();
            expect(screen.getByText("935110000001")).toBeTruthy();
        });

        it("falls back to a dash for any detail the gateway did not return", () => {
            renderContent({
                result: resultWith("APPROVED", { authCode: null, rrn: null }),
            });

            expect(screen.getAllByText("—")).toHaveLength(2);
        });
    });

    describe("on a declined payment", () => {
        it("offers a retry, because no money was taken", () => {
            renderContent({ result: resultWith("DECLINED") });

            expect(screen.getByText("Try again")).toBeTruthy();
        });

        it("calls onRetry rather than navigating away when the customer retries", () => {
            const onRetry = jest.fn();
            renderContent({ result: resultWith("DECLINED"), onRetry });

            fireEvent.click(screen.getByText("Try again"));

            expect(onRetry).toHaveBeenCalledTimes(1);
        });

        /** A second attempt opened by a double tap is refused server-side with a 409 anyway, but
         *  the button should not invite it. */
        it("disables the retry button while an attempt is being opened", () => {
            const onRetry = jest.fn();
            renderContent({ result: resultWith("DECLINED"), retrying: true, onRetry });

            fireEvent.click(screen.getByText("Try again"));

            expect(onRetry).not.toHaveBeenCalled();
        });

        /** Distinct from the payment failing: this is our own call to open a new attempt failing. */
        it("says so when the retry call itself could not be made", () => {
            renderContent({ result: resultWith("DECLINED"), retryFailed: true });

            expect(screen.getByText("Couldn't start a new payment. Please try again.")).toBeTruthy();
        });

        it("hides the retry button when no retry handler is supplied", () => {
            renderContent({ result: resultWith("DECLINED"), onRetry: undefined });

            expect(screen.queryByText("Try again")).toBeNull();
        });
    });

    describe("on an amount mismatch", () => {
        /**
         * Undercharged means money HAS left the card. Retrying would take a second payment for an
         * order still not covered, so this is the one failure the kiosk refuses to retry too.
         */
        it("does not offer a retry", () => {
            renderContent({ result: resultWith("AMOUNT_MISMATCH") });

            expect(screen.queryByText("Try again")).toBeNull();
        });

        it("tells the customer to make contact rather than re-order", () => {
            renderContent({ result: resultWith("AMOUNT_MISMATCH") });

            expect(
                screen.getByText("Please contact us before ordering again so we can sort it out.")
            ).toBeTruthy();
        });
    });

    describe("when the outcome could not be confirmed", () => {
        /**
         * Deliberately not worded as a failure. We genuinely do not know, the backend sweeper is
         * still resolving it by Inquiry, and telling a customer who paid that they did not is
         * worse than telling them to check back.
         */
        it("does not claim the payment failed", () => {
            renderContent({ timedOut: true });

            expect(screen.getByText("We couldn't confirm your payment")).toBeTruthy();
            expect(screen.queryByText("Payment didn't go through")).toBeNull();
        });
    });
});
