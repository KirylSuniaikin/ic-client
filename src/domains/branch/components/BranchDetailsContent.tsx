import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";
import BedtimeRoundedIcon from "@mui/icons-material/BedtimeRounded";
import DirectionsRoundedIcon from "@mui/icons-material/DirectionsRounded";
import DirectionsWalkRoundedIcon from "@mui/icons-material/DirectionsWalkRounded";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import { BRAND_RED } from "../../../shared/utils/theme";
import { PRIMARY_BUTTON_SX, SECTION_CARD_SX } from "../../delivery/components/sheetStyles";
import { useBranchDetails } from "../hooks/useBranchDetails";
import type { BranchHours } from "../utils/branchHours";
import type { NextOpening } from "../../schedule/utils/getNextOpening";
import { branchDisplayName } from "../utils/branchDisplayName";
import { getBranchShowcase } from "../utils/branchShowcase";
import { BranchPhotoStrip } from "./BranchPhotoStrip";
import type { CartItem } from "../../menu/types";
import type { IBranch } from "../../management/inventory/types";

/** Universal cross-platform deep link: opens the native app where there is one, the web map otherwise. */
function routeUrl(branch: IBranch): string | null {
    if (branch.latitude === null || branch.longitude === null) return null;
    return `https://www.google.com/maps/dir/?api=1&destination=${branch.latitude},${branch.longitude}`;
}

export interface BranchDetailsContentProps {
    branch: IBranch;
    /** Live cart; an empty one hides the availability card (unchanged rule). */
    cartItems: CartItem[];
    /** From the picker's resolved location; null or undefined hides the line. */
    distanceKm?: number | null;
    /** "sheet": everything scrolls together inside the phone Drawer.
     *  "pane": the PC picker's column; the body scrolls and Order here is pinned under it. */
    layout: "sheet" | "pane";
    /** Moves focus to the branch name on mount. The PC pane passes true. */
    autoFocusHeading?: boolean;
    onConfirm: (branch: IBranch) => void;
}

const PILL_SX: SxProps<Theme> = {
    display: "inline-flex",
    alignItems: "center",
    gap: 0.75,
    minHeight: 40,
    px: 2,
    borderRadius: 999,
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1.2,
};

const ROUTE_BUTTON_SX: SxProps<Theme> = {
    minHeight: 40,
    px: 2,
    borderRadius: 999,
    bgcolor: "#fff",
    border: "1px solid #f1eae4",
    color: "#3b352c",
    fontSize: 14,
    fontWeight: 700,
    textTransform: "none",
    boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
    "&:hover": { bgcolor: "#fff7f7", borderColor: BRAND_RED },
};

/**
 * Everything the customer sees about a branch before choosing it: photos (or a storefront
 * roundel when there are none), name and address, whether it is open, the way there, and whether
 * their cart survives the move.
 *
 * Shared by the phone bottom sheet and the PC picker's details column, so both ask the same one
 * question per open: the hook fetches once per mount and the parent keys this by branch.
 *
 * It only reports. "Order here" hands the branch back to the caller's existing flow, so the
 * cart-loss confirmation stays exactly where it was.
 */
export function BranchDetailsContent({
    branch,
    cartItems,
    distanceKm,
    layout,
    autoFocusHeading = false,
    onConfirm,
}: BranchDetailsContentProps): JSX.Element {
    const { t, i18n } = useTranslation("branch");
    const { loading, hours, unavailableNames, error } = useBranchDetails(branch, cartItems);

    const name = branchDisplayName(branch, i18n.language);
    const showcase = getBranchShowcase(branch, i18n.language);
    const mapsUrl = routeUrl(branch);

    const headingRef = useRef<HTMLHeadingElement>(null);
    useEffect(() => {
        if (autoFocusHeading) headingRef.current?.focus();
    }, [autoFocusHeading]);

    const body = (
        <>
            {/* The roundel stands in both for a branch with no photos and for photos that all
                failed to load, so the sheet never opens on an empty hole. */}
            {showcase !== null && showcase.photos.length > 0 ? (
                <BranchPhotoStrip
                    key={branch.id}
                    photos={showcase.photos}
                    branchName={name}
                    size={layout}
                    fallback={<BranchRoundel />}
                />
            ) : (
                <BranchRoundel />
            )}

            <Typography
                ref={headingRef}
                component="h2"
                variant="h5"
                tabIndex={-1}
                sx={{ fontWeight: 800, color: "#3b352c", textAlign: "center", letterSpacing: "-0.01em", outline: "none" }}
            >
                {name}
            </Typography>
            <Typography variant="body2" sx={{ color: "#8a807a", textAlign: "center", mt: 0.5 }}>
                {branch.address ?? t("details.noAddress")}
            </Typography>
            {typeof distanceKm === "number" && (
                <Typography variant="caption" sx={{ display: "block", color: "#8a807a", fontWeight: 600, textAlign: "center" }}>
                    {t("picker.distanceKm", { km: distanceKm.toFixed(1) })}
                </Typography>
            )}

            <Box sx={{ mt: 2, mb: 2.5 }}>
                {/* The status is a statement, the route an action: only the route looks pressable. */}
                <Box sx={{ display: "flex", gap: 1, justifyContent: "center", flexWrap: "wrap" }}>
                    <HoursPill hours={hours} />
                    {mapsUrl !== null && (
                        <Button
                            href={mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            startIcon={<DirectionsRoundedIcon sx={{ color: BRAND_RED }} />}
                            sx={ROUTE_BUTTON_SX}
                        >
                            {t("details.route")}
                        </Button>
                    )}
                </Box>
                {/* The reopening time sits under the pills, not inside the status pill: "Closed ·
                    opens tomorrow at 15:00" in the pill pushed Route onto a line of its own on a
                    390px phone and in the PC column, where the two should read as one pair. It is
                    a live region of its own so a screen reader still hears when the branch reopens. */}
                {hours.state === "closed" && hours.nextOpening !== null && (
                    <Typography
                        role="status"
                        data-testid="branch-details-reopens"
                        variant="body2"
                        sx={{ mt: 1, color: "#8a807a", fontWeight: 600, textAlign: "center" }}
                    >
                        {reopensLabel(hours.nextOpening, t)}
                    </Typography>
                )}
            </Box>

            {showcase !== null && showcase.findUs !== null && (
                <Box data-testid="branch-details-find-us" sx={{ ...SECTION_CARD_SX, display: "flex", gap: 1.5, mb: 2 }}>
                    <DirectionsWalkRoundedIcon sx={{ fontSize: 20, color: BRAND_RED, mt: "2px", flexShrink: 0 }} />
                    <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#3b352c" }}>
                            {t("details.findUsTitle")}
                        </Typography>
                        <Typography variant="body2" sx={{ color: "#3b352c", lineHeight: 1.5, whiteSpace: "pre-line" }}>
                            {showcase.findUs}
                        </Typography>
                    </Box>
                </Box>
            )}

            {/* Only ever shown with something in the cart: told to an empty-cart customer it
                is noise, and told wrongly it is a promise we break one screen later. */}
            {cartItems.length > 0 && (
                <Box sx={{ ...SECTION_CARD_SX, mb: 2.5 }}>
                    {loading ? (
                        <Typography variant="body2" sx={{ color: "#8a807a" }}>
                            {t("switchWarning.loading")}
                        </Typography>
                    ) : error !== null ? (
                        <Typography variant="body2" sx={{ color: "#b3261e" }}>
                            {t("switchWarning.error", { message: error })}
                        </Typography>
                    ) : unavailableNames.length === 0 ? (
                        <Typography variant="body2" sx={{ color: "#2e7d32", fontWeight: 600 }}>
                            {t("switchWarning.noItemsLost", { branchName: name })}
                        </Typography>
                    ) : (
                        <>
                            <Typography variant="body2" sx={{ color: "#8a5a00", fontWeight: 600, mb: 0.5 }}>
                                {t("switchWarning.itemsLost", { branchName: name })}
                            </Typography>
                            {unavailableNames.map((itemName) => (
                                <Typography
                                    key={itemName}
                                    variant="body2"
                                    data-testid="branch-details-unavailable-item"
                                    sx={{ color: "#3b352c" }}
                                >
                                    • {itemName}
                                </Typography>
                            ))}
                        </>
                    )}
                </Box>
            )}
        </>
    );

    const cta = (
        <Button variant="contained" onClick={() => onConfirm(branch)} sx={PRIMARY_BUTTON_SX}>
            {t("details.orderHere")}
        </Button>
    );

    if (layout === "sheet") {
        return (
            <>
                {body}
                {cta}
            </>
        );
    }

    return (
        <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
            <Box data-testid="branch-details-scroll" sx={{ flex: 1, minHeight: 0, overflowY: "auto", p: 3 }}>
                {body}
            </Box>
            <Box sx={{ p: 2, px: 3, borderTop: "1px solid #f1eae4", bgcolor: "#fffcf8" }}>
                {cta}
            </Box>
        </Box>
    );
}

/** The no-photo hero: the login popup's tinted roundel, smaller, so the sheet still has an anchor. */
function BranchRoundel(): JSX.Element {
    return (
        <Box
            data-testid="branch-details-hero"
            sx={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                bgcolor: "#FCE9E9",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                mx: "auto",
                mb: 1.5,
                boxShadow: "0 8px 24px rgba(228,75,76,0.18)",
            }}
        >
            <StorefrontRoundedIcon sx={{ fontSize: 32, color: BRAND_RED }} />
        </Box>
    );
}

function HoursPill({ hours }: { hours: BranchHours }): JSX.Element | null {
    const { t } = useTranslation("branch");

    // A failed fetch says nothing about the hours rather than calling the branch closed.
    if (hours.state === "unknown") return null;

    if (hours.state === "loading") {
        return (
            <Box role="status" data-testid="branch-details-hours" sx={{ ...PILL_SX, bgcolor: "#f4ede8", color: "#8a807a" }}>
                <CircularProgress size={14} color="inherit" />
                {t("details.checkingHours")}
            </Box>
        );
    }

    if (hours.state === "open") {
        return (
            <Box role="status" data-testid="branch-details-hours" sx={{ ...PILL_SX, bgcolor: "#EAF5EC", color: "#2e7d32" }}>
                <Box component="span" sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#4CAF50", flexShrink: 0 }} />
                {hours.closesAt === null ? t("details.openNow") : t("details.openUntil", { time: hours.closesAt })}
            </Box>
        );
    }

    return (
        <Box role="status" data-testid="branch-details-hours" sx={{ ...PILL_SX, bgcolor: "#FCE9E9", color: BRAND_RED }}>
            <BedtimeRoundedIcon sx={{ fontSize: 18 }} />
            {t("details.closedNow")}
        </Box>
    );
}

type Translate = ReturnType<typeof useTranslation>["t"];

function reopensLabel(nextOpening: NextOpening, t: Translate): string {
    const { time } = nextOpening;
    if (nextOpening.daysAhead === 0) return t("details.opensToday", { time });
    if (nextOpening.daysAhead === 1) return t("details.opensTomorrow", { time });
    const day = t(`days.${nextOpening.day}`, { ns: "schedule" });
    // Seven days ahead is today's own weekday: read on a Sunday, "Opens Sunday at 10:00" sounds
    // like later today, so it says next Sunday.
    if (nextOpening.daysAhead === 7) return t("details.opensNextWeek", { day, time });
    return t("details.opensOn", { day, time });
}
