import { createTheme } from "@mui/material/styles";

/**
 * The brand red. DESIGN.md names this as the one place it should come from, but the export did not
 * exist yet -- which is why the same hex is written as a literal in roughly ninety files. New code
 * imports this; existing literals are left alone rather than swept up in an unrelated change.
 */
export const BRAND_RED = "#E44B4C";

const theme = createTheme({
    palette: {
        mode: "light",
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