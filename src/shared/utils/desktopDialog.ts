import type { SxProps, Theme } from "@mui/material";

/**
 * The PC dialog chrome every customer popup shares: the item popups (ItemPopupShell), the
 * combo item editor, and the sheets that become dialogs or side panels on PC (CustomerSheet).
 */

/** One element of an `sx` array, derived from SxProps so no direct @mui/system import is needed. */
export type SxArrayEntry = Extract<SxProps<Theme>, ReadonlyArray<unknown>>[number];

/** MUI's documented pattern for spreading an `SxProps` into an `sx` array; `undefined` adds nothing. */
export function toArray(sx: SxProps<Theme> | undefined): ReadonlyArray<SxArrayEntry> {
    if (sx === undefined) return [];
    return Array.isArray(sx) ? sx : [sx];
}

// String, not a number: `sx` multiplies a numeric borderRadius by 4.
export const DESKTOP_DIALOG_RADIUS = "24px";
export const DESKTOP_DIALOG_SHADOW = "0 24px 60px rgba(15,23,42,0.22)";
export const DESKTOP_DIALOG_MAX_HEIGHT = "min(680px, 90vh)";

/** The absolutely centred paper Box placed inside a MUI `Modal` on PC. */
export function centredModalPaperSx(width: number): SxProps<Theme> {
    return {
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: `min(${width}px, 92vw)`,
        maxHeight: DESKTOP_DIALOG_MAX_HEIGHT,
        bgcolor: "#fff",
        borderRadius: DESKTOP_DIALOG_RADIUS,
        boxShadow: DESKTOP_DIALOG_SHADOW,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        outline: "none",
    };
}

/** Paper of a MUI Dialog on PC (the Dialog centres it). */
export function desktopDialogPaperSx(width: number, height?: string): SxProps<Theme> {
    return {
        width: `min(${width}px, 92vw)`,
        maxWidth: "none",
        m: 0,
        ...(height !== undefined ? { height } : {}),
        maxHeight: height !== undefined ? "90vh" : DESKTOP_DIALOG_MAX_HEIGHT,
        borderRadius: DESKTOP_DIALOG_RADIUS,
        boxShadow: DESKTOP_DIALOG_SHADOW,
        backgroundImage: "none",
    };
}

/** A full-height panel docked to the inline end, the cart's PC shape (CartComponent CART_ROOT_DESKTOP_SX).
 *  `left: "auto"` after `inset: 0` docks it right; the RTL stylis plugin flips it to the left in Arabic. */
export function sidePanelSx(width: number): SxProps<Theme> {
    return {
        position: "absolute",
        inset: 0,
        left: "auto",
        width,
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
        outline: "none",
    };
}
