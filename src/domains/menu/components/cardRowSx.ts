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

/** Text-only cards (staff order popup): a grid whose columns stretch, so every row ends at the
 *  right edge instead of leaving a gap after fixed 140px cards. */
const CARD_GRID_SX: SxProps<Theme> = {
    display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 1, mb: 2, py: 1, px: 0.2,
};

/** PC: wrap instead of a hidden-scrollbar strip a mouse wheel cannot move (D6).
 *  `fill` (text-only cards): the stretching grid on every screen; pair it with cardWidth(fill). */
export function useCardRowSx(fill = false): SxProps<Theme> {
    const isDesktop = useDesktopLayout();
    if (fill) return CARD_GRID_SX;
    return isDesktop ? CARD_ROW_DESKTOP_SX : CARD_ROW_SX;
}

/** A card's width in a useCardRowSx(fill) row: the grid column's, or the fixed 140px. */
export function cardWidth(fill: boolean): number | "auto" {
    return fill ? "auto" : 140;
}
