import { screen } from "@testing-library/react";
import { emotionRulesFor } from "../../management/couriers/components/emotionRules.testutil";

/**
 * DOM reads for the cart's layout suite (CartComponent.desktop.test.tsx): the things no role query
 * can reach. They live here because the suites' lint rules forbid direct node access.
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
