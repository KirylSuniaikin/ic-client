import type { SxProps, Theme } from "@mui/material";
import { useDesktopLayout } from "../../../shared/hooks/useDesktopLayout";

/** The 140px-card horizontal row shared verbatim by PizzaPopupContent.tsx:463-477,
 *  ToppingsScroll.tsx:33-46, ExtraIngrScroll.tsx:32-45 and BetterTogetherComponent.tsx:28-41.
 *  Key order is copied exactly so the phone CSS class hash is unchanged. `as const` makes it
 *  readonly: the phone path hands this one object to every row by reference. */
export const CARD_ROW_SX = {
    display: "flex", overflowX: "auto", gap: 1, mb: 2, py: 1, px: 0.2,
    scrollSnapType: "x mandatory", scrollbarWidth: "none",
    "&::-webkit-scrollbar": { display: "none" },
} as const;

const CARD_ROW_DESKTOP_SX: SxProps<Theme> = { ...CARD_ROW_SX, flexWrap: "wrap", overflowX: "visible" };

/** PC: wrap instead of a hidden-scrollbar strip a mouse wheel cannot move (D6). */
export function useCardRowSx(): SxProps<Theme> {
    const isDesktop = useDesktopLayout();
    return isDesktop ? CARD_ROW_DESKTOP_SX : CARD_ROW_SX;
}
