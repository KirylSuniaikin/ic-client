import type { SxProps, Theme } from "@mui/material";

const colorRed = "#E44B4C";
const hairline = "#e6e2d8";

/**
 * The house style for a Select or a `select` TextField: a pill outline on white, brand-red focus,
 * matching the toggle pills it sits next to. Spread onto the field's `sx`.
 */
export const ROUNDED_FIELD_SX: SxProps<Theme> = {
    "& .MuiOutlinedInput-root": {
        borderRadius: "999px",
        backgroundColor: "#fff",
        fontWeight: 600,
        // NotchedOutline inherits the radius, but say it outright: a Select's fieldset is the
        // element actually drawing the border, and an inherited value is easy to lose to a
        // competing rule from an ancestor's sx.
        "& .MuiOutlinedInput-notchedOutline": {
            borderRadius: "999px",
            borderColor: hairline,
        },
        "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#d3cec1" },
        "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: colorRed,
            borderWidth: "1.5px",
        },
    },
    // The notch cuts a gap for the floating label, and on a pill that gap needs the same inset
    // the text has or it collides with the curve.
    "& .MuiInputLabel-root": { color: "#8a8f98" },
    "& .MuiInputLabel-root.Mui-focused": { color: colorRed },
    "& .MuiSelect-select": { pl: 2 },
};

/**
 * Matching dropdown surface: rounded card, hairline border, pill-shaped options, brand tint on the
 * selected one. `zIndex` is required only for menus opened from inside a ResponsiveSheet, whose
 * own stacking level is above the default popover — pass SHEET_Z_INDEX + 10 there.
 */
export function roundedMenuProps(zIndex?: number): Record<string, unknown> {
    return {
        ...(zIndex === undefined ? {} : { sx: { zIndex } }),
        slotProps: {
            paper: {
                elevation: 0,
                sx: {
                    mt: 0.75,
                    borderRadius: "16px",
                    border: `1px solid #efece4`,
                    boxShadow: "0 12px 32px rgba(15,23,42,0.12)",
                    "& .MuiList-root": { py: 0.75 },
                    "& .MuiMenuItem-root": {
                        mx: 0.75,
                        my: 0.25,
                        px: 1.5,
                        py: 1,
                        borderRadius: "10px",
                        fontSize: "0.9rem",
                        fontWeight: 500,
                        "&:hover": { backgroundColor: "#f7f5f0" },
                        "&.Mui-selected": {
                            backgroundColor: "#fdeaea",
                            color: "#b3282a",
                            fontWeight: 700,
                        },
                        "&.Mui-selected:hover": { backgroundColor: "#fbdede" },
                    },
                },
            },
        },
    };
}

/** Pill button in the brand red, for a sheet's primary action. */
export const BRAND_BUTTON_SX: SxProps<Theme> = {
    borderRadius: "999px",
    py: 1.4,
    fontWeight: 700,
    textTransform: "none",
    bgcolor: colorRed,
    "&:hover": { bgcolor: "#c73c3d" },
};

/** Its quiet counterpart — Cancel, Done, and anything else that is not the main action. */
export const NEUTRAL_BUTTON_SX: SxProps<Theme> = {
    borderRadius: "999px",
    py: 1.2,
    fontWeight: 600,
    textTransform: "none",
    color: "#4a4f57",
    borderColor: hairline,
    "&:hover": { borderColor: "#d3cec1", backgroundColor: "#f7f5f0" },
};
