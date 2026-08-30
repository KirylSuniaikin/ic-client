import { createTheme } from "@mui/material/styles";

/**
 * The brand red, and the ONE place it should be defined.
 *
 * <p>It is currently also written as a literal in roughly ninety files, which is how the app ended
 * up with no theme colour at all: every component that needed the brand said so itself, and every
 * component that did not got Material blue. New code should import this rather than add a
 * ninety-first copy.
 */
export const BRAND_RED = "#E44B4C";

/** The pressed/hover end of the brand gradient, taken from the customer OTP sheet's CTA. */
const BRAND_RED_DARK = "#D0393A";

/** The one green in the app, used for "payment approved" and the order-confirmed toast. */
const SUCCESS_GREEN = "#4CAF50";

/**
 * The app's MUI theme.
 *
 * <h2>Why a palette exists here at all now</h2>
 * This file used to be `createTheme({ palette: { mode: "light" } })` and nothing else — no palette,
 * no typography, no shape. So every MUI component nobody styled by hand rendered in stock Material
 * blue `#1976d2`, and the owner found one of them on the payment-result screen: an
 * `outlined` Button with no `color` prop, sitting under a brand-red heading.
 *
 * <p>That was never a styling slip on one screen. 153 of the app's 163 `<Button>`s carry no colour
 * of their own, so the default palette is what most of the product actually renders. Nobody chose
 * blue; it was simply what was left.
 *
 * <h2>What this repaints</h2>
 * Everything that took the default: roughly 102 buttons across the admin/POS and 61 on the
 * storefront, plus unstyled `CircularProgress`, `Checkbox`, `Switch`, `Tabs` and the focus ring on
 * `TextField`. That was a deliberate decision by the owner — one identity everywhere — and it is a
 * large, immediately visible change rather than a quiet one.
 *
 * <h2>What is deliberately NOT set</h2>
 * <ul>
 *   <li><b>`shape.borderRadius`.</b> It stays at MUI's default 4, because `sx={{ borderRadius: N }}`
 *       is multiplied by it. The app is full of `borderRadius: 4` meaning 16 px; changing the base
 *       would silently rescale every rounded corner in the product.</li>
 *   <li><b>`typography.button.textTransform`.</b> The surfaces that want sentence case already say
 *       so. Flipping it here would restyle every remaining button's casing in the same commit as
 *       the colour, and two changes at once is how a regression hides.</li>
 *   <li><b>`background.default`.</b> The storefront's warm ground is painted by its own layout, not
 *       by `CssBaseline`; setting it here would change nothing on some screens and something on
 *       others.</li>
 * </ul>
 */
const theme = createTheme({
    palette: {
        mode: "light",
        primary: {
            main: BRAND_RED,
            dark: BRAND_RED_DARK,
            // Explicit rather than computed: MUI picks black or white from a contrast threshold,
            // and on a mid-tone red like this the automatic answer is the one nobody wants. Every
            // hand-styled brand button in the app already puts white on it.
            contrastText: "#ffffff",
        },
        success: {
            main: SUCCESS_GREEN,
            contrastText: "#ffffff",
        },
    },
    breakpoints: {
        values: {
            xs: 0,
            sm: 600,
            md: 900,
            lg: 1200,
            xl: 1536
        }
    },
});

export default theme;
