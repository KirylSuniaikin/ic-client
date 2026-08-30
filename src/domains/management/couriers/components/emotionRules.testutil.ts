/**
 * Reads back the CSS emotion actually generated for one rendered element.
 *
 * Test-only, and it exists because neither ordinary route works here:
 *  - this repo wires no jest-dom matchers at all (there is no `setupTests` file), so
 *    `toHaveStyle` does not exist;
 *  - `window.getComputedStyle` comes back EMPTY for every emotion class, because emotion inserts
 *    its rules through the CSSOM (`sheet.insertRule`) rather than as style-tag text, and jsdom's
 *    cascade never sees them.
 *
 * The CSSOM is where they DO exist, media queries and all — which matters, because a responsive
 * `sx` value compiles to nothing else. This is therefore the only way to assert that a breakpoint
 * token reached a particular node, rather than merely asserting that the token was exported.
 *
 * Named `.testutil.ts` deliberately: CRA's testMatch collects `*.test.*`, so a helper called
 * `*.test-something` would be picked up as an empty suite and fail the run.
 */
export function emotionRulesFor(element: Element): string {
    const classes = Array.from(element.classList).filter((name) => name.startsWith("css-"));
    if (classes.length === 0) return "";

    const rules: string[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
        for (const rule of Array.from(sheet.cssRules)) {
            if (classes.some((name) => rule.cssText.includes(`.${name}`))) rules.push(rule.cssText);
        }
    }
    // Whitespace-normalised: emotion's spacing between property and value is an implementation
    // detail, and an assertion that depended on it would break on a library bump.
    return rules.join("\n").replace(/\s*:\s*/g, ":").replace(/\s+/g, " ");
}
