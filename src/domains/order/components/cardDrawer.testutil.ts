/**
 * DOM lookups the card drawer's and its loader's suites share. Named `.testutil.ts` so CRA's
 * testMatch does not collect it, and so the suites themselves keep to Testing Library queries.
 */

/** The box the gateway's hosted fields mount in: the LTR wrapper around the card number. */
export function cardFieldContainer(): Element {
    const container = document.getElementById("card-number")?.closest("[dir='ltr']");
    if (!container) throw new Error("no card field container");
    return container;
}

/** The loader's drawing. */
export function loaderDrawing(loader: Element): SVGSVGElement {
    const svg = loader.querySelector("svg");
    if (svg === null) throw new Error("no loader drawing");
    return svg;
}

/** One named part of the loader's drawing ("dough", "sauce", "link", "heart"), or null. */
export function loaderPart(loader: Element, part: string): Element | null {
    return loaderDrawing(loader).querySelector(`.${part}`);
}
