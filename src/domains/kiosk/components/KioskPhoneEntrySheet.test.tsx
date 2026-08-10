import { jest, describe, it, expect } from "@jest/globals";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "../../../shared/i18n";
import { KioskPhoneEntrySheet } from "./KioskPhoneEntrySheet";

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

/** Opens the MUI select and picks a country by its visible option text. */
async function selectCountry(optionText: string | RegExp): Promise<void> {
    await userEvent.click(screen.getByRole("combobox", { name: "Country" }));
    await userEvent.click(within(screen.getByRole("listbox")).getByText(optionText));
}

describe("KioskPhoneEntrySheet", () => {
    it("asks for a country and a phone number only — no name, no branch picker", () => {
        renderSheet();

        expect(screen.getByText("Enter your phone number")).toBeTruthy();
        expect(screen.getByRole("combobox", { name: "Country" })).toBeTruthy();
        expect(screen.queryByLabelText(/name/i)).toBeNull();
        expect(screen.queryByLabelText(/branch/i)).toBeNull();
    });

    // A kiosk sits in one country, so making the local customer change it every time would be a
    // tax on the common case.
    it("opens on Bahrain so the overwhelmingly common case needs no interaction", async () => {
        const { props } = renderSheet();

        await userEvent.type(phoneInput(), "12345678");
        await userEvent.click(screen.getByRole("button", { name: "Place order" }));

        expect(props.onSubmit).toHaveBeenCalledWith("97312345678");
    });

    // The sheet is a Drawer above MUI's default modal layer; the Select menu portals to <body> at
    // that default and opened BEHIND the sheet, leaving the customer tapping an invisible list.
    it("opens the country menu ABOVE the sheet, not behind it", async () => {
        renderSheet();

        await userEvent.click(screen.getByRole("combobox", { name: "Country" }));

        const menuLayer = screen.getByRole("listbox").closest(".MuiPopover-root");
        const sheetLayer = document.querySelector(".MuiDrawer-root");
        const zIndexOf = (el: Element | null): number =>
            Number(window.getComputedStyle(el as Element).zIndex);

        expect(zIndexOf(menuLayer)).toBeGreaterThan(zIndexOf(sheetLayer));
    });

    it("submits the selected country's code prefixed to the typed digits", async () => {
        const { props } = renderSheet();

        await selectCountry(/Saudi Arabia/);
        await userEvent.type(phoneInput(), "512345678");
        await userEvent.click(screen.getByRole("button", { name: "Place order" }));

        expect(props.onSubmit).toHaveBeenCalledWith("966512345678");
    });

    // Bahrain wants 8 digits, Saudi Arabia 9 — validating against a hardcoded length would reject
    // every valid foreign number.
    it("validates the length against the selected country, not a fixed 8", async () => {
        const { props } = renderSheet();

        await selectCountry(/Saudi Arabia/);
        await userEvent.type(phoneInput(), "12345678");
        await userEvent.click(screen.getByRole("button", { name: "Place order" }));

        expect(props.onSubmit).not.toHaveBeenCalled();
        expect(screen.getByText("Phone number must be exactly 9 digits")).toBeTruthy();
    });

    it("truncates digits that no longer fit when the customer switches to a shorter country", async () => {
        renderSheet();

        await selectCountry(/Saudi Arabia/);
        await userEvent.type(phoneInput(), "512345678");
        await selectCountry(/Bahrain/);

        expect(phoneInput().value).toBe("51234567");
    });

    it("rejects a short number and does not submit", async () => {
        const { props } = renderSheet();

        await userEvent.type(phoneInput(), "123");
        await userEvent.click(screen.getByRole("button", { name: "Place order" }));

        expect(props.onSubmit).not.toHaveBeenCalled();
        expect(screen.getByText("Phone number must be exactly 8 digits")).toBeTruthy();
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

        expect(screen.getByRole("button", { name: /place order|^$/i }).hasAttribute("disabled")).toBe(true);
    });

    it("clears the number AND the country when the sheet closes, so the next customer starts fresh", async () => {
        const { view, props } = renderSheet();
        await selectCountry(/Saudi Arabia/);
        await userEvent.type(phoneInput(), "512345678");

        view.rerender(<KioskPhoneEntrySheet {...props} open={false} />);
        view.rerender(<KioskPhoneEntrySheet {...props} open={true} />);

        expect(phoneInput().value).toBe("");
        expect(screen.getByRole("combobox", { name: "Country" }).textContent).toBe("+973");
    });
});
