import { screen } from "@testing-library/react";
import { emotionRulesFor } from "../../management/couriers/components/emotionRules.testutil";

/**
 * DOM reads for the cart and payment-page suites: the things no role query can reach (layout,
 * focus, portal roots, layers, payment marks). They live here because the suites' lint rules
 * forbid direct node access.
 *
 * Named `.testutil.ts` deliberately: CRA's testMatch collects `*.test.*`, so a helper called
 * `*.test-something` would be picked up as an empty suite and fail the run.
 */

/** The phone cart's positioned root Box: title Typography → header Box → root Box. */
export function phoneCartRoot(): HTMLElement {
    const root = screen.getByText("Cart").parentElement?.parentElement;
    if (root == null) throw new Error("no cart root above the title");
    return root;
}

/** The nearest ancestor that scrolls (`overflow-y: auto`), or null when none does. */
export function scrollContainerOf(element: Element): HTMLElement | null {
    for (let node = element.parentElement; node !== null; node = node.parentElement) {
        if (emotionRulesFor(node).includes("overflow-y:auto")) return node;
    }
    return null;
}

/** The backdrop of the Modal that holds `element`. */
export function backdropOf(element: Element): HTMLElement {
    const backdrop = element.closest(".MuiModal-root")?.querySelector<HTMLElement>(".MuiBackdrop-root");
    if (backdrop == null) throw new Error("no Modal backdrop around the element");
    return backdrop;
}

/** The element that has focus. Throws when nothing does, so lost focus fails loudly. */
export function focusedElement(): HTMLElement {
    const element = document.activeElement;
    if (!(element instanceof HTMLElement)) throw new Error("nothing is focused");
    return element;
}

type SheetForm = "drawer" | "dialog";

/** The open sheet's portal root: the phone's Drawer or the PC's Dialog. */
export function sheetRoot(form: SheetForm): HTMLElement {
    const root = document.querySelector<HTMLElement>(form === "drawer" ? ".MuiDrawer-root" : ".MuiDialog-root");
    if (root === null) throw new Error(`no ${form} on screen`);
    return root;
}

/** The Modal root that holds `element`. */
export function modalRootOf(element: Element): HTMLElement | null {
    return element.closest<HTMLElement>(".MuiModal-root");
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

const PAYMENT_GLYPHS: Readonly<Record<string, string>> = {
    CreditCardRoundedIcon: "card",
    AppleIcon: "apple",
    StorefrontRoundedIcon: "counter",
};

/** What an element shows as its payment mark: a logo's file, the glyph's name ("card", "apple", "counter"), or null. */
export function paymentMarkOf(element: Element): string | null {
    const logo = element.querySelector("img");
    if (logo !== null) return logo.getAttribute("src");
    const glyph = Object.keys(PAYMENT_GLYPHS).find((id) => element.querySelector(`[data-testid='${id}']`) !== null);
    return glyph === undefined ? null : PAYMENT_GLYPHS[glyph];
}

/** A rendered payment logo, by its file. */
export function paymentLogo(src: string): HTMLImageElement {
    const logo = document.querySelector<HTMLImageElement>(`img[src="${src}"]`);
    if (logo === null) throw new Error(`no payment logo ${src}`);
    return logo;
}

/** The box an element sits in, for reading the padding around it. */
export function wrapperOf(element: Element): Element {
    const parent = element.parentElement;
    if (parent === null) throw new Error("element has no wrapper");
    return parent;
}
