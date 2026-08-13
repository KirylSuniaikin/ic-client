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

function nameInput(): HTMLInputElement {
    return screen.getByRole("textbox", { name: "Name" }) as HTMLInputElement;
}

// Both fields filled, in the order a customer meets them.
async function fillBoth(name = "Layla", digits = "12345678"): Promise<void> {
    await userEvent.type(nameInput(), name);
    await userEvent.type(phoneInput(), digits);
}

const submitButton = (): HTMLElement =>
    screen.getByRole("button", { name: "Continue to payment" });

describe("KioskPhoneEntrySheet", () => {
    // Still no branch picker — the backend derives the branch from the paired kiosk.
    it("asks for a name and a phone number, and nothing else", () => {
        renderSheet();

        expect(screen.getByText("Enter your phone number")).toBeTruthy();
        expect(nameInput()).toBeTruthy();
        expect(phoneInput()).toBeTruthy();
        expect(screen.queryByLabelText(/branch/i)).toBeNull();
    });

    it("submits the name alongside the country code prefixed to the typed digits", async () => {
        const { props } = renderSheet();

        await fillBoth();
        await userEvent.click(submitButton());

        expect(props.onSubmit).toHaveBeenCalledWith(`${PHONE_COUNTRY_CODE}12345678`, "Layla");
    });

    it("trims surrounding whitespace off the name", async () => {
        const { props } = renderSheet();

        await fillBoth("  Layla  ");
        await userEvent.click(submitButton());

        expect(props.onSubmit).toHaveBeenCalledWith(`${PHONE_COUNTRY_CODE}12345678`, "Layla");
    });

    it("rejects a missing name and does not submit", async () => {
        const { props } = renderSheet();

        await userEvent.type(phoneInput(), "12345678");
        await userEvent.click(submitButton());

        expect(props.onSubmit).not.toHaveBeenCalled();
        expect(screen.getByText("Name is required")).toBeTruthy();
    });

    // A name of nothing but spaces would otherwise reach the kitchen as a blank label.
    it("rejects a name of only whitespace", async () => {
        const { props } = renderSheet();

        await fillBoth("   ");
        await userEvent.click(submitButton());

        expect(props.onSubmit).not.toHaveBeenCalled();
        expect(screen.getByText("Name is required")).toBeTruthy();
    });

    it("clears the previous customer's name when the sheet closes", async () => {
        const { view, props } = renderSheet();

        await userEvent.type(nameInput(), "Layla");
        view.rerender(<KioskPhoneEntrySheet {...props} open={false} />);
        view.rerender(<KioskPhoneEntrySheet {...props} open={true} />);

        expect(nameInput().value).toBe("");
    });

    it("rejects a short number and does not submit", async () => {
        const { props } = renderSheet();

        await userEvent.type(nameInput(), "Layla");
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
