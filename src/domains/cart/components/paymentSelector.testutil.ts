import { fireEvent, screen, waitFor } from "@testing-library/react";

/**
 * Drives the cart's payment row and its sheet (PaymentMethodSelector) for the cart suites.
 *
 * Named `.testutil.ts` deliberately: CRA's testMatch collects `*.test.*`, so a helper called
 * `*.test-something` would be picked up as an empty suite and fail the run.
 */

/** The row's accessible name for a method, as a screen reader hears it: section title, then value. */
export function paymentRowName(method: string): string {
    return `Payment method ${method}`;
}

/** Matches the row whatever method it currently names. */
export const PAYMENT_ROW_NAME = /^Payment method .+$/;

export function paymentRow(): HTMLElement {
    return screen.getByRole("button", { name: PAYMENT_ROW_NAME });
}

export function openPaymentSheet(): void {
    fireEvent.click(paymentRow());
}

/**
 * Resolves once the sheet has left the DOM. Until its exit transition ends, MUI keeps the cart
 * behind it aria-hidden, so the cart's own buttons are not reachable by role yet.
 */
export async function waitForPaymentSheetToClose(): Promise<void> {
    await waitFor(() => {
        if (screen.queryByRole("radiogroup", { hidden: true }) !== null) {
            throw new Error("the payment sheet is still open");
        }
    });
}

/** Opens the sheet, picks `method`, and waits until the cart is reachable again. */
export async function choosePayment(method: string): Promise<void> {
    openPaymentSheet();
    fireEvent.click(screen.getByRole("radio", { name: method }));
    await waitForPaymentSheetToClose();
}

/** The methods the sheet lists, in order. Leaves the sheet open. */
export function listedPaymentMethods(): string[] {
    openPaymentSheet();
    return screen.getAllByRole("radio").map((radio) => radio.textContent ?? "");
}

// The DOM reads below live here rather than in the suites: the suites' lint rules forbid direct
// node access, and these are the things no role query can reach (focus, portal roots, layers).

/** The element that has focus. Throws when nothing does, so lost focus fails loudly. */
export function focusedElement(): HTMLElement {
    const element = document.activeElement;
    if (!(element instanceof HTMLElement)) throw new Error("nothing is focused");
    return element;
}

type SheetForm = "drawer" | "dialog";

function findSheetRoot(form: SheetForm): HTMLElement | null {
    return document.querySelector<HTMLElement>(form === "drawer" ? ".MuiDrawer-root" : ".MuiDialog-root");
}

/** The open sheet's portal root: the phone's Drawer or the PC's Dialog. */
export function sheetRoot(form: SheetForm): HTMLElement {
    const root = findSheetRoot(form);
    if (root === null) throw new Error(`no ${form} on screen`);
    return root;
}

export function hasSheetRoot(form: SheetForm): boolean {
    return findSheetRoot(form) !== null;
}

/** The cart's own Modal root, found from its title. */
export function cartModalRoot(): HTMLElement | null {
    return screen.getByText("Cart").closest<HTMLElement>(".MuiModal-root");
}

/** The z-index a modal root paints at. */
export function layerOf(root: HTMLElement | null): number {
    if (root === null) throw new Error("no modal root");
    return Number(window.getComputedStyle(root).zIndex);
}

/** What an element shows as its payment mark: a logo's file, "card" for the card glyph, or null. */
export function paymentMarkOf(element: Element): string | null {
    const logo = element.querySelector("img");
    if (logo !== null) return logo.getAttribute("src");
    return element.querySelector("[data-testid='CreditCardRoundedIcon']") !== null ? "card" : null;
}

/** A rendered payment logo, by its file. */
export function paymentLogo(src: string): HTMLImageElement {
    const logo = document.querySelector<HTMLImageElement>(`img[src="${src}"]`);
    if (logo === null) throw new Error(`no payment logo ${src}`);
    return logo;
}
