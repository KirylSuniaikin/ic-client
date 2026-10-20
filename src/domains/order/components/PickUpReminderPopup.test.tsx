import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { Modal } from "@mui/material";

// PickUpReminderPopup renders its copy via useTranslation("checkout") — initialize the
// real i18n instance (side-effect import) so keys resolve to English, mirroring
// CustomerLoginPopup.test.tsx.
import "../../../shared/i18n";

import { PickUpReminderPopup } from "./PickUpReminderPopup";

const TITLE = "This order for Pick Up only";
const ACTION = "Place pick up order";

describe("PickUpReminderPopup", () => {
    const onClose = jest.fn<void, []>();
    const onClick = jest.fn<void, []>();

    function renderPopup() {
        render(<PickUpReminderPopup onClose={onClose} onClick={onClick} />);
        // The full-screen backdrop; the card is its child.
        return { backdrop: screen.getByTestId("pickup-reminder-backdrop") };
    }

    beforeEach(() => {
        onClose.mockReset();
        onClick.mockReset();
    });

    // The regression this popup was fixed for: the backdrop dismisses on tap, and a tap
    // anywhere on the card used to bubble up to it — silently discarding the order the
    // customer had already built and verified over OTP.
    it("does not dismiss when the card body is tapped", () => {
        renderPopup();

        fireEvent.click(screen.getByText(TITLE));

        expect(onClose).not.toHaveBeenCalled();
        expect(onClick).not.toHaveBeenCalled();
    });

    it("dismisses when the backdrop outside the card is tapped", () => {
        const { backdrop } = renderPopup();

        fireEvent.click(backdrop);

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onClick).not.toHaveBeenCalled();
    });

    // The payment page is a Modal. A first-time customer's Pay opens this reminder while that page
    // is still up, and the reminder used to render underneath it: Pay looked like it did nothing.
    it("opens on top of a page that is already showing in a Modal", () => {
        render(
            <>
                <Modal open onClose={() => undefined}>
                    <div>Payment page</div>
                </Modal>
                <PickUpReminderPopup onClose={onClose} onClick={onClick} />
            </>,
        );
        const paymentPage = screen.getByText("Payment page").closest(".MuiModal-root") as HTMLElement;
        const reminder = screen.getByTestId("pickup-reminder-backdrop").closest(".MuiModal-root") as HTMLElement;

        expect(paymentPage.compareDocumentPosition(reminder) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        // MUI hides every modal below the top one from assistive tech; the payment page being
        // hidden is what proves the reminder is the one in front.
        expect(paymentPage.getAttribute("aria-hidden")).toBe("true");

        fireEvent.click(screen.getByRole("button", { name: ACTION }));
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("places the order — and does not dismiss — when the action button is tapped", () => {
        renderPopup();

        fireEvent.click(screen.getByRole("button", { name: ACTION }));

        expect(onClick).toHaveBeenCalledTimes(1);
        expect(onClose).not.toHaveBeenCalled();
    });
});
