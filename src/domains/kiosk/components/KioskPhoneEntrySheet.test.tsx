import { jest, describe, it, expect } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "../../../shared/i18n";
import { KioskPhoneEntrySheet } from "./KioskPhoneEntrySheet";
import { PHONE_COUNTRY_CODE, PHONE_DIGIT_COUNT } from "../config";

function renderSheet(overrides: Partial<Parameters<typeof KioskPhoneEntrySheet>[0]> = {}) {
    const props = {
        open: true,
        submitting: false,
        checkoutError: null as string | null,
        onClose: jest.fn(),
        onSubmit: jest.fn(),
        ...overrides,
    };
    const view = render(<KioskPhoneEntrySheet {...props} />);
    return { props, view };
}

function phoneInput(): HTMLInputElement {
    return screen.getByRole("textbox", { name: "Phone number" }) as HTMLInputElement;
}

describe("KioskPhoneEntrySheet", () => {
    it("asks for a phone number only — no name, no branch picker", () => {
        renderSheet();

        expect(screen.getByText("Enter your phone number")).toBeTruthy();
        expect(screen.queryByLabelText(/name/i)).toBeNull();
        expect(screen.queryByLabelText(/branch/i)).toBeNull();
    });

    it("submits the country code prefixed to the typed digits", async () => {
        const { props } = renderSheet();

        await userEvent.type(phoneInput(), "12345678");
        await userEvent.click(screen.getByRole("button", { name: "Continue to payment" }));

        expect(props.onSubmit).toHaveBeenCalledWith(`${PHONE_COUNTRY_CODE}12345678`);
    });

    it("rejects a short number and does not submit", async () => {
        const { props } = renderSheet();

        await userEvent.type(phoneInput(), "123");
        await userEvent.click(screen.getByRole("button", { name: "Continue to payment" }));

        expect(props.onSubmit).not.toHaveBeenCalled();
        expect(screen.getByText(`Phone number must be exactly ${PHONE_DIGIT_COUNT} digits`)).toBeTruthy();
    });

    it("never lets a non-digit into the field", async () => {
        renderSheet();

        await userEvent.type(phoneInput(), "12ab34");

        expect(phoneInput().value).toBe("1234");
    });

    it("warns on a non-digit, then clears the warning once a digit follows", async () => {
        renderSheet();

        await userEvent.type(phoneInput(), "12a");
        expect(screen.getByText("Only digits are allowed")).toBeTruthy();

        await userEvent.type(phoneInput(), "3");
        expect(screen.queryByText("Only digits are allowed")).toBeNull();
    });

    it("shows a checkout failure without wiping the typed digits", async () => {
        const { view, props } = renderSheet();
        await userEvent.type(phoneInput(), "12345678");

        view.rerender(<KioskPhoneEntrySheet {...props} checkoutError="Something went wrong. Please try again." />);

        // The customer must not have to retype their number after a failed attempt.
        expect(phoneInput().value).toBe("12345678");
        expect(screen.getByText("Something went wrong. Please try again.")).toBeTruthy();
    });

    it("disables the submit button while an attempt is in flight", () => {
        renderSheet({ submitting: true });

        expect(screen.getByRole("button").hasAttribute("disabled")).toBe(true);
    });

    it("clears the number when the sheet closes, so the next customer starts fresh", async () => {
        const { view, props } = renderSheet();
        await userEvent.type(phoneInput(), "12345678");

        view.rerender(<KioskPhoneEntrySheet {...props} open={false} />);
        view.rerender(<KioskPhoneEntrySheet {...props} open={true} />);

        expect(phoneInput().value).toBe("");
    });
});
