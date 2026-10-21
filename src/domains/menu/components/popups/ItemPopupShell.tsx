import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Box, Fab, Modal } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useDesktopLayout } from "../../../../shared/hooks/useDesktopLayout";
import { BRAND_RED } from "../../../../shared/utils/theme";
import {
    DESKTOP_DIALOG_MAX_HEIGHT,
    DESKTOP_DIALOG_RADIUS,
    DESKTOP_DIALOG_SHADOW,
    centredModalPaperSx,
    toArray,
} from "../../../../shared/utils/desktopDialog";
import type { SxArrayEntry } from "../../../../shared/utils/desktopDialog";

// Re-exported so combo/ItemEditorPopup keeps importing them from here.
export { DESKTOP_DIALOG_MAX_HEIGHT, DESKTOP_DIALOG_RADIUS, DESKTOP_DIALOG_SHADOW, toArray };

export interface ItemPopupLegacyLayout {
    /** Today's sheet Box sx, MOVED verbatim from the popup (never edited) — keeps the phone,
     *  admin and kiosk path byte-identical, md-keyed values included. */
    paperSx: SxProps<Theme>;
    /** Today's scroll container sx. Omit when the paper itself scrolls (CrossSell) or nothing
     *  scrolls (Upsell): media/children/footer are then direct children of the paper. */
    scrollSx?: SxProps<Theme>;
    /** First child of the scroll container: the popup's current photo block, unchanged. */
    media?: ReactNode;
}

export interface ItemPopupDesktopLayout {
    /** Present → two columns (photo | options). Absent → one centred column. */
    photo?: { src?: string; alt: string };
    /** Two columns with this in the photo's place, on the same warm ground: the cart's items.
     *  It scrolls on its own, so a long list never pushes the options' footer away. Ignored
     *  when `photo` is given. */
    aside?: ReactNode;
    /** Single-column width cap in px. Default 560. Ignored for two columns. */
    width?: number;
    /** Merged into the options column's scroll area (padding for children that relied on the
     *  legacy scroll Box's padding). */
    bodySx?: SxProps<Theme>;
    /** Options-column background. Default "#fff"; combos pass "#fafafa" (their card ground). */
    surface?: string;
}

export interface ItemPopupShellProps {
    open: boolean;
    onClose: () => void;
    legacy: ItemPopupLegacyLayout;
    desktop?: ItemPopupDesktopLayout;
    /** Modal root sx on both paths (UpsellPopup's backdrop blur, UpSellPopup.tsx:38-40). */
    modalSx?: SxProps<Theme>;
    /** The popup's own footer Box (Add button, pizza size toggle), passed unchanged. Legacy:
     *  last child of the paper. PC: pinned under the options scroll area. */
    footer?: ReactNode;
    /** Round close button. Default true. CrossSell and Upsell pass false (they have none today). */
    showClose?: boolean;
    /** While true the Modal neither pulls focus back into itself nor closes on Escape: a dialog
     *  outside its portal owns both for now. That is Apple Pay's QR outside Safari, which Apple's
     *  SDK draws in its own <apple-pay-modal> on <body>. Default false. */
    yieldFocus?: boolean;
    children: ReactNode;
}

/** The warm track of SEGMENTED_GROUP_SX; the photo is multiplied onto it so the white corners
 *  of the opaque WebP photos disappear. */
const DESKTOP_PHOTO_BG = "#f4ede8";

// Key order matches the Fab every popup rendered before the shell, so the legacy class is unchanged.
// Exported for the customer profile's PC dialog, which wears the same round close button.
export const CLOSE_FAB_SX: SxProps<Theme> = {
    position: "absolute",
    top: 16,
    right: 16,
    color: BRAND_RED,
    backgroundColor: "#fff",
    zIndex: 9999,
};

const SPLIT_PAPER_SX: SxProps<Theme> = {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "min(960px, 92vw)",
    height: DESKTOP_DIALOG_MAX_HEIGHT,
    bgcolor: "#fff",
    borderRadius: DESKTOP_DIALOG_RADIUS,
    boxShadow: DESKTOP_DIALOG_SHADOW,
    overflow: "hidden",
    display: "flex",
    flexDirection: "row",
    outline: "none",
};

// The column beside the options, whether it holds a photo or a list.
const WARM_COLUMN_SX = {
    flex: "0 0 45%",
    minWidth: 0,
    bgcolor: DESKTOP_PHOTO_BG,
} satisfies SxProps<Theme>;

const PHOTO_COLUMN_SX: SxProps<Theme> = {
    ...WARM_COLUMN_SX,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    p: 4,
};

// A list rather than one image: top-aligned and scrolling instead of centred. Exported for the
// customer profile's PC dialog, whose account column sits on the same warm ground.
export const ASIDE_COLUMN_SX: SxProps<Theme> = {
    ...WARM_COLUMN_SX,
    minHeight: 0,
    overflowY: "auto",
    p: 3,
};

const PHOTO_SX: SxProps<Theme> = {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    mixBlendMode: "multiply",
    display: "block",
};

function bodySx(split: boolean, showClose: boolean): SxArrayEntry {
    return {
        flex: split ? 1 : "1 1 auto",
        minHeight: 0,
        overflowY: "auto",
        // Keeps the 40px close button clear of the title.
        ...(showClose ? { pt: 5 } : {}),
    };
}

/**
 * The one Modal every item popup, and the cart, renders. Below md — and for admin and kiosk at any
 * width — it reproduces each popup's original sheet exactly (`legacy`); on a customer PC it becomes
 * a centred dialog with an optional photo or aside column (`desktop`). Popup state lives above the
 * shell, so the subtree swap when the viewport crosses 900px loses nothing.
 */
export function ItemPopupShell({
    open,
    onClose,
    legacy,
    desktop,
    modalSx,
    footer,
    showClose = true,
    yieldFocus = false,
    children,
}: ItemPopupShellProps): JSX.Element {
    const { t } = useTranslation("customerAuth");
    const isDesktop = useDesktopLayout();

    // No z-index on the Modal on either path: everything stacked above a popup (ItemEditorPopup
    // at 2000, later Modals at 1300) relies on MUI's default and on portal order.
    if (!isDesktop) {
        return (
            <Modal
                open={open}
                onClose={onClose}
                sx={modalSx}
                disableEnforceFocus={yieldFocus}
                disableEscapeKeyDown={yieldFocus}
            >
                <Box sx={legacy.paperSx}>
                    {showClose && (
                        <Fab size="small" onClick={onClose} aria-label={undefined} sx={CLOSE_FAB_SX}>
                            <CloseIcon/>
                        </Fab>
                    )}
                    {legacy.scrollSx
                        ? <Box sx={legacy.scrollSx}>{legacy.media}{children}</Box>
                        : <>{legacy.media}{children}</>}
                    {footer}
                </Box>
            </Modal>
        );
    }

    const photo = desktop?.photo;
    const aside = photo === undefined ? desktop?.aside : undefined;
    const split = photo !== undefined || aside !== undefined;

    return (
        <Modal
            open={open}
            onClose={onClose}
            sx={modalSx}
            disableEnforceFocus={yieldFocus}
            disableEscapeKeyDown={yieldFocus}
        >
            <Box data-testid="item-popup-dialog" sx={split ? SPLIT_PAPER_SX : centredModalPaperSx(desktop?.width ?? 560)}>
                {showClose && (
                    <Fab size="small" onClick={onClose} aria-label={t("login.close")} sx={CLOSE_FAB_SX}>
                        <CloseIcon/>
                    </Fab>
                )}
                {photo && (
                    <Box data-testid="item-popup-photo" sx={PHOTO_COLUMN_SX}>
                        {photo.src && <Box component="img" src={photo.src} alt={photo.alt} sx={PHOTO_SX}/>}
                    </Box>
                )}
                {aside !== undefined && <Box data-testid="item-popup-aside" sx={ASIDE_COLUMN_SX}>{aside}</Box>}
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        flex: 1,
                        minWidth: 0,
                        minHeight: 0,
                        bgcolor: desktop?.surface ?? "#fff",
                    }}
                >
                    <Box sx={[bodySx(split, showClose), ...toArray(desktop?.bodySx)]}>{children}</Box>
                    {footer}
                </Box>
            </Box>
        </Modal>
    );
}
