import { describe, it, expect } from "@jest/globals";
import theme, { BRAND_RED } from "./theme";

/**
 * The palette, pinned.
 *
 * <p>Nothing else in this suite asserts a colour — which is exactly why the app shipped with MUI's
 * stock Material blue on 153 of its 163 buttons for as long as it did. The theme had no palette at
 * all, so every component nobody styled by hand rendered blue, and no test could notice.
 *
 * <p>These are cheap and they only fail when someone changes the brand or "tidies" the theme back
 * to defaults. Both are things a person should have to mean.
 */
describe("theme palette", () => {
    it("renders unstyled components in the brand red, not Material blue", () => {
        expect(theme.palette.primary.main).toBe(BRAND_RED);
    });

    /**
     * Named rather than merely "not the brand": `#1976d2` is the specific value that was shipping,
     * and a future default would be a different wrong colour that this spells out by contrast.
     */
    it("has left MUI's default primary behind", () => {
        expect(theme.palette.primary.main).not.toBe("#1976d2");
    });

    /** Every hand-styled brand button in the app puts white on this red; MUI's own contrast
     * threshold does not reliably agree, so the answer is stated rather than computed. */
    it("puts white on the brand red", () => {
        expect(theme.palette.primary.contrastText).toBe("#ffffff");
    });

    /**
     * The trap this theme must never spring.
     *
     * <p>`sx={{ borderRadius: N }}` is MULTIPLIED by `shape.borderRadius`. The app is full of
     * `borderRadius: 4` meaning 16 px, so raising this base to, say, 8 would silently double every
     * rounded corner in the product — a change nobody would connect to the theme file.
     */
    it("leaves the radius base alone, because sx multiplies by it", () => {
        expect(theme.shape.borderRadius).toBe(4);
    });
});
