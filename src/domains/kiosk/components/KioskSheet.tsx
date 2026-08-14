import { Box, Drawer } from "@mui/material";
import type { ReactNode } from "react";

/** Brand red, matching the rest of the customer-facing surfaces. */
export const KIOSK_BRAND_RED = "#E44B4C";

/**
 * Kiosk sheets sit above the cart's MUI `Modal` (default z-index 1300) so that an
 * items-unavailable error, which reopens the cart, can never bury a live sheet.
 * Below the branch picker (99999), which must always win.
 *
 * Exported because anything a sheet opens in a PORTAL — a Select menu, a popover — lands at the
 * MUI default 1300 and would render *behind* the sheet that opened it. Those must be lifted
 * relative to this value rather than to a second hardcoded number.
 */
export const KIOSK_SHEET_Z_INDEX = 1400;

interface KioskSheetProps {
    open: boolean;
    /**
     * Omit to make the sheet non-dismissible. A sheet shown while a payment is live must not be
     * closable by backdrop tap or Escape — dismissing it would strand a real, unpaid order with
     * neither "pay at the counter" nor "cancel" answered.
     */
    onClose?: () => void;
    /** Adds a scroll container — needed only by the approved sheet's optional DCC block. */
    scrollable?: boolean;
    children: ReactNode;
}

/**
 * Shared bottom-sheet shell for every kiosk surface. Follows the project's popup convention
 * (`.claude/CLAUDE.md` § Popup / Drawer convention), copying `CashInputDrawer.tsx`: rounded top
 * corners, centred grey drag-handle pill, `p: 3, pb: 4` content box, capped width on wider screens.
 *
 * Extracted rather than repeated across the five sheets so the styling stays in one place.
 */
export function KioskSheet({ open, onClose, scrollable = false, children }: KioskSheetProps): JSX.Element {
    const dismissible = onClose !== undefined;

    return (
        <Drawer
            anchor="bottom"
            open={open}
            onClose={onClose ?? (() => {})}
            sx={{ zIndex: KIOSK_SHEET_Z_INDEX }}
            ModalProps={{ disableEscapeKeyDown: !dismissible }}
            PaperProps={{
                sx: {
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                    maxWidth: { sm: 500 },
                    mx: { sm: "auto" },
                    ...(scrollable ? { maxHeight: "90vh", overflowY: "auto" } : {}),
                },
            }}
        >
            <Box sx={{ p: 3, pb: 4 }}>
                <Box sx={{ width: 40, height: 4, bgcolor: "grey.300", borderRadius: 2, mx: "auto", mb: 2 }} />
                {children}
            </Box>
        </Drawer>
    );
}

export default KioskSheet;
