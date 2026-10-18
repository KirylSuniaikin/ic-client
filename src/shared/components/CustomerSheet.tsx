import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import { Box, Dialog, Drawer, Modal } from "@mui/material";
import type { DrawerProps, ModalProps, SxProps, Theme } from "@mui/material";
import { useDesktopLayout } from "../hooks/useDesktopLayout";
import { desktopDialogPaperSx, sidePanelSx, toArray } from "../utils/desktopDialog";

/** How a CustomerSheet is on screen right now: the phone bottom sheet, a centred PC dialog, or a
 *  PC panel docked to the inline end. */
export type SheetPresentation = "sheet" | "dialog" | "panel";

export type CustomerSheetDesktop =
    | { placement: "center"; width: number; height?: string; paperSx?: SxProps<Theme> }
    | { placement: "side"; width: number; paperSx?: SxProps<Theme>; transparentBackdrop?: boolean };

export interface CustomerSheetProps {
    open: boolean;
    /** undefined → not dismissable by backdrop or Esc, on both paths. */
    onClose?: ModalProps["onClose"];
    /** Today's Drawer root sx (its zIndex), unchanged. Applied on both paths. When absent the PC
     *  root gets theme.zIndex.drawer, so the stacking order never changes. */
    sx?: SxProps<Theme>;
    /** Today's Drawer PaperProps, unchanged. Phone path only. */
    PaperProps?: DrawerProps["PaperProps"];
    /** PC only: id of the visible title. */
    labelledBy?: string;
    desktop: CustomerSheetDesktop;
    children: ReactNode | ((presentation: SheetPresentation) => ReactNode);
}

// The default is "sheet", so a sheet rendered outside any CustomerSheet (and the phone path, which
// provides nothing) keeps its handle and its exact markup.
const SheetPresentationContext = createContext<SheetPresentation>("sheet");

/** "sheet" outside any CustomerSheet (the default), so existing sheets are unaffected. */
export function useSheetPresentation(): SheetPresentation {
    return useContext(SheetPresentationContext);
}

// A Dialog or Modal defaults to theme.zIndex.modal (1300); the phone Drawers these replace sit at
// theme.zIndex.drawer (1200). Keeping 1200 means a popup opened before CrossSell, Keeta or
// BenefitPay (1300) still paints under them on PC, exactly as on the phone.
const DRAWER_LAYER_SX: SxProps<Theme> = { zIndex: (theme: Theme) => theme.zIndex.drawer };

const TRANSPARENT_BACKDROP_SLOT_PROPS: ModalProps["slotProps"] = {
    backdrop: { sx: { backgroundColor: "transparent" } },
};

/**
 * One wrapper for the customer popups that are bottom Drawers on a phone.
 *
 * Below md, and wherever DesktopLayoutAllowedContext says no (admin, kiosk), it renders the very
 * Drawer the popup rendered before, with the same props, so the phone markup and CSS do not move.
 * On a customer PC it renders a centred MUI Dialog (`placement: "center"`) or a full-height panel
 * docked to the inline end (`placement: "side"`), keeping the phone's z-index.
 */
export function CustomerSheet({
    open,
    onClose,
    sx,
    PaperProps,
    labelledBy,
    desktop,
    children,
}: CustomerSheetProps): JSX.Element {
    const live = useDesktopLayout();
    // The form is chosen when the popup opens and kept until it closes: the card drawer's hosted
    // fields and the OTP inputs must not remount because a window was resized or an iPad rotated
    // mid-flow. Adjusting state while rendering is React's documented pattern for this.
    const [latched, setLatched] = useState(live);
    if (!open && latched !== live) setLatched(live);
    const isDesktop = open ? latched : live;

    const presentation: SheetPresentation = !isDesktop
        ? "sheet"
        : desktop.placement === "side" ? "panel" : "dialog";
    const content = typeof children === "function" ? children(presentation) : children;

    if (presentation === "sheet") {
        return (
            <Drawer anchor="bottom" open={open} onClose={onClose} sx={sx} PaperProps={PaperProps}>
                {content}
            </Drawer>
        );
    }

    if (desktop.placement === "center") {
        return (
            <SheetPresentationContext.Provider value="dialog">
                <Dialog
                    open={open}
                    onClose={onClose}
                    sx={sx ?? DRAWER_LAYER_SX}
                    maxWidth={false}
                    aria-labelledby={labelledBy}
                    PaperProps={{ sx: [...toArray(desktopDialogPaperSx(desktop.width, desktop.height)), ...toArray(desktop.paperSx)] }}
                >
                    {content}
                </Dialog>
            </SheetPresentationContext.Provider>
        );
    }

    return (
        <SheetPresentationContext.Provider value="panel">
            <Modal
                open={open}
                onClose={onClose}
                sx={sx ?? DRAWER_LAYER_SX}
                // A transparent backdrop, never hideBackdrop: without a backdrop element an outside
                // click would do nothing, and the stacked order detail relies on it to step back.
                slotProps={desktop.transparentBackdrop ? TRANSPARENT_BACKDROP_SLOT_PROPS : undefined}
            >
                <Box
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={labelledBy}
                    sx={[...toArray(sidePanelSx(desktop.width)), ...toArray(desktop.paperSx)]}
                >
                    {content}
                </Box>
            </Modal>
        </SheetPresentationContext.Provider>
    );
}
