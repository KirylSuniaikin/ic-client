import { useTranslation } from "react-i18next";
import { Alert, Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import type { IBranch } from "../../management/inventory/types";

/** Shared with the picker's floating CTA so the two never drift apart. */
export const BRAND_RED = "#E44B4C";
const brandRed = BRAND_RED;

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
}: BranchListViewProps): JSX.Element {
    const { t } = useTranslation("branch");

    return (
        <Box>
            {!hideNearestButton && (
                <Button
                    variant="outlined"
                    fullWidth
                    startIcon={locating ? <CircularProgress size={16} /> : <MyLocationIcon />}
                    onClick={onUseNearestBranch}
                    disabled={locating}
                    sx={{ textTransform: "none", mb: 2, borderColor: brandRed, color: brandRed }}
                >
                    {t("picker.useNearestBranch")}
                </Button>
            )}

            {locationError !== null && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    {locationError}
                </Alert>
            )}

            <Stack spacing={1.5}>
                {branches.map((branch) => {
                    // distances is null until an origin exists; a coordinate-less branch stays
                    // null within a resolved distances map too — both read as "no distance".
                    const distanceKm = distances?.[branch.id] ?? null;
                    const isNearest = nearestBranchId !== null && nearestBranchId === branch.id;

                    return (
                        <Button
                            key={branch.id}
                            // Addressable without matching on the branch name: that same name is
                            // also rendered by the chip behind the drawer and by the drawer's own
                            // heading, so a getByText query finds three nodes and throws.
                            data-testid={`branch-option-${branch.id}`}
                            variant="outlined"
                            onClick={() => onSelectBranch(branch)}
                            sx={{
                                textTransform: "none",
                                justifyContent: "flex-start",
                                borderRadius: 3,
                                py: 1.5,
                                px: 2,
                                borderColor: isNearest ? brandRed : "#e0e0e0",
                                color: "#000",
                            }}
                        >
                            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", width: "100%" }}>
                                <Typography variant="subtitle1" fontWeight="bold">
                                    {branch.branchName}
                                    {isNearest ? ` · ${t("picker.nearestBadge")}` : ""}
                                </Typography>
                                {distanceKm !== null && (
                                    <Typography variant="body2" sx={{ color: "#666" }}>
                                        {t("picker.distanceKm", { km: distanceKm.toFixed(1) })}
                                    </Typography>
                                )}
                            </Box>
                        </Button>
                    );
                })}
            </Stack>
        </Box>
    );
}
