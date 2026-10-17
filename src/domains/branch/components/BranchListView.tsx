import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Box, Button, ButtonBase, CircularProgress, Stack, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import MyLocationRoundedIcon from "@mui/icons-material/MyLocationRounded";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import { OUTLINED_BUTTON_SX, SheetNotice } from "../../delivery/components/sheetStyles";
import { branchDisplayName } from "../utils/branchDisplayName";
import { getBranchShowcase } from "../utils/branchShowcase";
import type { IBranch } from "../../management/inventory/types";

/** Shared with the picker's floating CTA so the two never drift apart. */
export const BRAND_RED = "#E44B4C";

export interface BranchListViewProps {
    branches: IBranch[];
    /** null before "use nearest branch" has resolved an origin; once resolved, one entry per
     * branch id (null distanceKm for a branch with no coordinates). */
    distances: Record<string, number | null> | null;
    nearestBranchId: string | null;
    onSelectBranch: (branch: IBranch) => void;
    onUseNearestBranch: () => void;
    locating: boolean;
    locationError: string | null;
    /** Map mode renders the nearest action as a floating CTA over the map; the list would
     *  otherwise show a second, identical button a few pixels away. */
    hideNearestButton?: boolean;
    /** PC picker only: the row to focus when the list mounts, i.e. the branch whose details the
     *  customer just stepped back from. The phone passes nothing. */
    focusBranchId?: string | null;
}

/** Presentational, always mounted — the no-key fallback IS this component. */
export function BranchListView({
    branches,
    distances,
    nearestBranchId,
    onSelectBranch,
    onUseNearestBranch,
    locating,
    locationError,
    hideNearestButton = false,
    focusBranchId = null,
}: BranchListViewProps): JSX.Element {
    const { t, i18n } = useTranslation("branch");
    const theme = useTheme();
    const ChevronIcon = theme.direction === "rtl" ? ChevronLeftRoundedIcon : ChevronRightRoundedIcon;

    // This list's own effect runs after its own rows exist, even inside the Dialog portal.
    const returnFocusRef = useRef<HTMLButtonElement | null>(null);
    useEffect(() => {
        if (focusBranchId !== null) returnFocusRef.current?.focus();
    }, [focusBranchId]);

    return (
        <Box>
            {!hideNearestButton && (
                <Button
                    variant="outlined"
                    fullWidth
                    startIcon={locating ? <CircularProgress size={16} color="inherit" /> : <MyLocationRoundedIcon />}
                    onClick={onUseNearestBranch}
                    disabled={locating}
                    sx={{ ...OUTLINED_BUTTON_SX, py: 1.25, mb: 2 }}
                >
                    {t("picker.useNearestBranch")}
                </Button>
            )}

            {locationError !== null && (
                <Box sx={{ mb: 2 }}>
                    <SheetNotice tone="warning">{locationError}</SheetNotice>
                </Box>
            )}

            <Stack spacing={1}>
                {branches.map((branch) => {
                    // distances is null until an origin exists; a coordinate-less branch stays
                    // null within a resolved distances map too — both read as "no distance".
                    const distanceKm = distances?.[branch.id] ?? null;
                    const isNearest = nearestBranchId !== null && nearestBranchId === branch.id;
                    const cover = getBranchShowcase(branch, i18n.language)?.photos[0] ?? null;

                    return (
                        <ButtonBase
                            key={branch.id}
                            ref={branch.id === focusBranchId ? returnFocusRef : undefined}
                            // Addressable without matching on the branch name: that same name is
                            // also rendered by the chip behind the drawer and by the drawer's own
                            // heading, so a getByText query finds three nodes and throws.
                            data-testid={`branch-option-${branch.id}`}
                            onClick={() => onSelectBranch(branch)}
                            sx={{
                                width: "100%",
                                display: "flex",
                                alignItems: "center",
                                gap: 1.5,
                                p: 1.5,
                                textAlign: "start",
                                borderRadius: "16px",
                                bgcolor: "#fff",
                                border: "1px solid",
                                borderColor: isNearest ? BRAND_RED : "#f1eae4",
                                boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
                                "&:hover": { borderColor: isNearest ? BRAND_RED : "#e6d8cf" },
                                "&.Mui-focusVisible": { outline: `2px solid ${BRAND_RED}`, outlineOffset: 2 },
                            }}
                        >
                            <Box sx={{ width: 56, height: 56, borderRadius: "12px", overflow: "hidden", flexShrink: 0 }}>
                                {cover !== null ? (
                                    // alt="" because the branch name follows right next to it.
                                    <Box
                                        component="img"
                                        src={cover.src}
                                        alt=""
                                        sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                                    />
                                ) : (
                                    <Box sx={{ width: "100%", height: "100%", bgcolor: "#FCE9E9", display: "flex",
                                               alignItems: "center", justifyContent: "center" }}>
                                        <StorefrontRoundedIcon sx={{ fontSize: 26, color: BRAND_RED }} />
                                    </Box>
                                )}
                            </Box>

                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography noWrap sx={{ fontWeight: 700, color: "#3b352c", fontSize: 16 }}>
                                    {branchDisplayName(branch, i18n.language)}
                                </Typography>
                                {branch.address && (
                                    <Typography variant="body2" noWrap sx={{ color: "#8a807a" }}>
                                        {branch.address}
                                    </Typography>
                                )}
                                {distanceKm !== null && (
                                    <Typography variant="caption" sx={{ color: "#8a807a", fontWeight: 600 }}>
                                        {t("picker.distanceKm", { km: distanceKm.toFixed(1) })}
                                    </Typography>
                                )}
                            </Box>

                            {isNearest && (
                                <Box component="span" sx={{ px: 1, py: 0.25, borderRadius: 999, bgcolor: "#FCE9E9",
                                                            color: BRAND_RED, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                                    {t("picker.nearestBadge")}
                                </Box>
                            )}

                            <ChevronIcon sx={{ color: "#c9bfb8", flexShrink: 0 }} />
                        </ButtonBase>
                    );
                })}
            </Stack>
        </Box>
    );
}
