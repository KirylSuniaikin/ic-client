import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Button, CircularProgress, IconButton, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import CloseIcon from "@mui/icons-material/Close";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import ArrowForwardIosRoundedIcon from "@mui/icons-material/ArrowForwardIosRounded";
import { CustomerSheet } from "../../../shared/components/CustomerSheet";
import type { IBranch } from "../../management/inventory/types";
import type { CartItem } from "../../menu/types";
import type { Coordinates } from "../types";
import { haversineDistanceKm } from "../utils/haversine";
import { GOOGLE_MAPS_API_KEY } from "../utils/mapsConfig";
import { BranchMapView } from "./BranchMapView";
import { BRAND_RED, BranchListView } from "./BranchListView";
import { BranchDetailsSheet } from "./BranchDetailsSheet";
import { BranchDetailsContent } from "./BranchDetailsContent";

/**
 * The branch closest to a point, or null when there is no point or no branch has coordinates.
 *
 * <p>Shared by the badge in the list and by the "use nearest" action, so the branch the customer
 * is shown and the branch the button opens cannot be two different ones.
 */
function nearestBranchTo(origin: Coordinates | null, branches: IBranch[]): IBranch | null {
    if (origin === null) return null;
    let best: IBranch | null = null;
    let bestDistanceKm = Infinity;
    for (const branch of branches) {
        if (branch.latitude === null || branch.longitude === null) continue;
        const distanceKm = haversineDistanceKm(origin, {
            latitude: branch.latitude,
            longitude: branch.longitude,
        });
        if (distanceKm < bestDistanceKm) {
            bestDistanceKm = distanceKm;
            best = branch;
        }
    }
    return best;
}

export interface BranchPickerDrawerProps {
    open: boolean;
    branches: IBranch[];
    /** Reports the choice upward only — never persists it. The caller decides what "choosing
     * this branch" means (first-visit gate vs. a mid-session switch). */
    onSelect: (branch: IBranch) => void;
    /** Omit or false for the mandatory first-visit gate: no close affordance is rendered and the
     * Drawer's backdrop/Esc dismissal is a no-op. true only for a deliberately reopened picker
     * (the re-entry chip), where declining to switch is a valid outcome. */
    dismissable?: boolean;
    /** Required when dismissable=true; ignored otherwise. */
    onClose?: () => void;
    /** Feeds the details sheet's availability line. Empty is fine — the line hides itself. */
    cartItems?: CartItem[];
}

/**
 * The picker (task-spec.md §5.4). Shows a Google Map with one pin per branch when
 * GOOGLE_MAPS_API_KEY is set, and ALWAYS shows the plain BranchListView — the no-key fallback
 * IS the list view, not a separate degraded mode, so branch selection works identically with or
 * without a Maps key.
 */
export function BranchPickerDrawer({
    open,
    branches,
    onSelect,
    dismissable = false,
    onClose,
    cartItems = [],
}: BranchPickerDrawerProps): JSX.Element {
    const { t } = useTranslation("branch");
    const isRtl = useTheme().direction === "rtl";

    const [origin, setOrigin] = useState<Coordinates | null>(null);
    const [locating, setLocating] = useState(false);
    const [locationError, setLocationError] = useState<string | null>(null);

    const distances = useMemo<Record<string, number | null> | null>(() => {
        if (origin === null) return null;
        const result: Record<string, number | null> = {};
        for (const branch of branches) {
            result[branch.id] =
                branch.latitude !== null && branch.longitude !== null
                    ? haversineDistanceKm(origin, { latitude: branch.latitude, longitude: branch.longitude })
                    : null;
        }
        return result;
    }, [origin, branches]);

    const nearestBranchId = useMemo<string | null>(
        () => nearestBranchTo(origin, branches)?.id ?? null,
        [origin, branches]
    );

    // Geolocation is requested ONLY here, on a deliberate tap — never on mount/render.
    function handleUseNearestBranch(): void {
        if (typeof navigator === "undefined" || !navigator.geolocation) {
            setLocationError(t("picker.locationUnsupported"));
            return;
        }
        setLocating(true);
        setLocationError(null);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const resolved = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                };
                setOrigin(resolved);
                setLocating(false);
                // Open the winner, exactly as tapping its pin would.
                //
                // Without this the button did its whole job and showed nothing: `nearestBranchId`
                // is read only by BranchListView, which in map mode starts hidden, and the map is
                // given `activeBranchId` from the details sheet rather than from this. So the
                // customer tapped the one big red CTA, watched a spinner, and got back the same
                // screen — the branch HAD been chosen, silently.
                //
                // Describing it rather than selecting it outright keeps the one rule this picker
                // has: `onSelect` fires only from the details sheet's own CTA, so "nearest" can
                // never commit a branch the customer has not looked at.
                const nearest = nearestBranchTo(resolved, branches);
                if (nearest !== null) {
                    setDetailsBranch(nearest);
                }
            },
            () => {
                // Denied, unavailable or timed out all read the same to the customer, mirroring
                // AddressPickerDrawer's requestLocation.
                setLocationError(t("picker.locationDenied"));
                setLocating(false);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    }

    // With a map, the list starts hidden and the map IS the dialog — the layout the owner asked
    // for. Without a key there is no map, so the list is the only thing to show and starts open.
    const mapMode = Boolean(GOOGLE_MAPS_API_KEY);
    const [listOpen, setListOpen] = useState(!mapMode);

    // Tapping a branch describes it first; `onSelect` fires only from the details sheet's CTA.
    // Both the map and the list go through it, so the two entry points cannot diverge.
    const [detailsBranch, setDetailsBranch] = useState<IBranch | null>(null);

    // PC only: the row "All branches" returns focus to. The phone list never reads it.
    const [returnFocusId, setReturnFocusId] = useState<string | null>(null);

    function back(): void {
        if (detailsBranch !== null) setReturnFocusId(detailsBranch.id);
        setDetailsBranch(null);
    }

    // On PC the details are a step inside this dialog, so Esc or a backdrop click on that step
    // goes back to the list rather than closing the picker. On a phone this only ever runs with
    // no details open: the details Drawer sits on top and takes Esc and backdrop clicks itself.
    function handlePickerClose(): void {
        if (detailsBranch !== null) {
            back();
            return;
        }
        if (dismissable) onClose?.();
    }
    const pickerOnClose = dismissable || detailsBranch !== null ? handlePickerClose : undefined;

    function confirmBranch(branch: IBranch): void {
        setDetailsBranch(null);
        onSelect(branch);
    }

    // The phone form: exactly the tree this picker rendered before the PC dialog existed.
    const sheetTree = (
        <>
            {mapMode ? (
                <Box sx={{ position: "relative", height: "100%", bgcolor: "#f4f1ea" }}>
                    <BranchMapView
                        branches={branches}
                        onSelectBranch={setDetailsBranch}
                        activeBranchId={detailsBranch?.id ?? null}
                        height="100%"
                    />

                    {/* Everything below floats OVER the map. pointerEvents is managed per-element
                        so the transparent spacer never eats a pan gesture. */}
                    <Box
                        sx={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            flexDirection: "column",
                            pointerEvents: "none",
                            p: 2,
                        }}
                    >
                        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, pointerEvents: "auto" }}>
                            <IconButton
                                aria-label={listOpen ? t("picker.hideList") : t("picker.showList")}
                                onClick={() => setListOpen((wasOpen) => !wasOpen)}
                                sx={{ bgcolor: "rgba(255,255,255,0.92)", "&:hover": { bgcolor: "#fff" } }}
                            >
                                <FormatListBulletedIcon />
                            </IconButton>

                            <Box sx={{ flex: 1 }} />

                            {dismissable && onClose && (
                                <IconButton
                                    aria-label={t("picker.close")}
                                    onClick={onClose}
                                    sx={{ bgcolor: "rgba(255,255,255,0.92)", "&:hover": { bgcolor: "#fff" } }}
                                >
                                    <CloseIcon />
                                </IconButton>
                            )}
                        </Box>

                        {listOpen && (
                            <Box
                                sx={{
                                    pointerEvents: "auto",
                                    mt: 1,
                                    bgcolor: "#fff",
                                    borderRadius: 3,
                                    p: 2,
                                    maxHeight: "45%",
                                    overflowY: "auto",
                                }}
                            >
                                <BranchListView
                                    branches={branches}
                                    distances={distances}
                                    nearestBranchId={nearestBranchId}
                                    onSelectBranch={setDetailsBranch}
                                    onUseNearestBranch={handleUseNearestBranch}
                                    locating={locating}
                                    locationError={locationError}
                                    hideNearestButton
                                />
                            </Box>
                        )}

                        <Box sx={{ flex: 1 }} />

                        {locationError !== null && (
                            <Typography
                                variant="body2"
                                sx={{
                                    pointerEvents: "auto",
                                    mb: 1,
                                    px: 2,
                                    py: 1,
                                    borderRadius: 2,
                                    bgcolor: "rgba(0,0,0,0.72)",
                                    color: "#fff",
                                }}
                            >
                                {locationError}
                            </Typography>
                        )}

                        <Button
                            fullWidth
                            variant="contained"
                            onClick={handleUseNearestBranch}
                            disabled={locating}
                            startIcon={locating ? <CircularProgress size={18} color="inherit" /> : <MyLocationIcon />}
                            sx={{
                                pointerEvents: "auto",
                                py: 1.5,
                                borderRadius: 999,
                                textTransform: "none",
                                fontWeight: 700,
                                fontSize: 16,
                                bgcolor: BRAND_RED,
                                "&:hover": { bgcolor: BRAND_RED, filter: "brightness(0.92)" },
                            }}
                        >
                            {t("picker.useNearestBranch")}
                        </Button>
                    </Box>
                </Box>
            ) : (
                <Box sx={{ p: 3, pb: 4, position: "relative", overflowY: "auto" }}>
                    <Box sx={{ width: 40, height: 4, bgcolor: "grey.300", borderRadius: 2, mx: "auto", mb: 2 }} />

                    {dismissable && onClose && (
                        <IconButton
                            aria-label={t("picker.close")}
                            onClick={onClose}
                            sx={{ position: "absolute", top: 12, right: 12 }}
                        >
                            <CloseIcon />
                        </IconButton>
                    )}

                    <Typography variant="h6" fontWeight="bold" sx={{ mb: 0.5 }}>
                        {t("picker.title")}
                    </Typography>
                    <Typography variant="body2" sx={{ color: "#666", mb: 2 }}>
                        {t("picker.subtitle")}
                    </Typography>

                    <BranchListView
                        branches={branches}
                        distances={distances}
                        nearestBranchId={nearestBranchId}
                        onSelectBranch={setDetailsBranch}
                        onUseNearestBranch={handleUseNearestBranch}
                        locating={locating}
                        locationError={locationError}
                    />
                </Box>
            )}

            <BranchDetailsSheet
                branch={detailsBranch}
                cartItems={cartItems}
                distanceKm={detailsBranch === null ? null : distances?.[detailsBranch.id] ?? null}
                onClose={() => setDetailsBranch(null)}
                onConfirm={confirmBranch}
            />
        </>
    );

    /**
     * The PC form. The list is always visible (no toggle) and the details replace it in the same
     * column with an "All branches" step back, instead of opening a second layer over the map.
     */
    function renderDialog(): JSX.Element {
        return (
            <>
                <Box sx={{ display: "flex", height: mapMode ? "100%" : undefined, minHeight: 0 }}>
                    <Box
                        sx={{
                            width: mapMode ? 400 : "100%",
                            flexShrink: 0,
                            display: "flex",
                            flexDirection: "column",
                            minHeight: 0,
                            bgcolor: "#fffcf8",
                            // Flips to the left edge in Arabic, where the list sits on the right.
                            borderRight: mapMode ? "1px solid #f1eae4" : undefined,
                        }}
                    >
                        {detailsBranch === null ? renderListPane() : renderDetailsPane(detailsBranch)}
                    </Box>

                    {mapMode && (
                        <Box sx={{ flex: 1, minWidth: 0, position: "relative", bgcolor: "#f4f1ea" }}>
                            <BranchMapView
                                branches={branches}
                                onSelectBranch={setDetailsBranch}
                                activeBranchId={detailsBranch?.id ?? null}
                                height="100%"
                                layout="dialog"
                            />
                        </Box>
                    )}
                </Box>

                {dismissable && onClose && (
                    <IconButton
                        aria-label={t("picker.close")}
                        onClick={onClose}
                        sx={{
                            position: "absolute",
                            top: 16,
                            right: 16,
                            zIndex: 1,
                            bgcolor: "rgba(255,255,255,0.92)",
                            boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
                            "&:hover": { bgcolor: "#fff" },
                        }}
                    >
                        <CloseRoundedIcon />
                    </IconButton>
                )}
            </>
        );
    }

    function renderListPane(): JSX.Element {
        return (
            <>
                <Box sx={{ p: 3, pb: 2, pr: dismissable && !mapMode ? 7 : 3 }}>
                    <Typography component="h2" variant="h6" sx={{ fontWeight: 800, color: "#3b352c" }}>
                        {t("picker.title")}
                    </Typography>
                    <Typography variant="body2" sx={{ color: "#8a807a", mt: 0.5 }}>
                        {t("picker.subtitle")}
                    </Typography>
                </Box>
                <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 3, pb: 3 }}>
                    {/* Keeps its own "Use nearest branch" button: there is no floating CTA on PC. */}
                    <BranchListView
                        branches={branches}
                        distances={distances}
                        nearestBranchId={nearestBranchId}
                        onSelectBranch={setDetailsBranch}
                        onUseNearestBranch={handleUseNearestBranch}
                        locating={locating}
                        locationError={locationError}
                        focusBranchId={returnFocusId}
                    />
                </Box>
            </>
        );
    }

    function renderDetailsPane(branch: IBranch): JSX.Element {
        return (
            <>
                <Box
                    sx={{
                        minHeight: 56,
                        display: "flex",
                        alignItems: "center",
                        px: 1.5,
                        borderBottom: "1px solid #f1eae4",
                    }}
                >
                    <Button
                        startIcon={isRtl ? <ArrowForwardIosRoundedIcon /> : <ArrowBackIosNewRoundedIcon />}
                        onClick={back}
                        sx={{ textTransform: "none", fontWeight: 700, color: "#3b352c", borderRadius: 999, px: 1.5 }}
                    >
                        {t("picker.allBranches")}
                    </Button>
                </Box>
                <BranchDetailsContent
                    key={branch.id}
                    branch={branch}
                    cartItems={cartItems}
                    distanceKm={distances?.[branch.id] ?? null}
                    layout="pane"
                    autoFocusHeading
                    onConfirm={confirmBranch}
                />
            </>
        );
    }

    return (
        <CustomerSheet
            open={open}
            onClose={pickerOnClose}
            // The cart's "Pick up from" card opens this ON TOP of the still-open cart, a MUI Modal
            // at theme.zIndex.modal (1300), while a Drawer defaults to zIndex.drawer (1200). MUI's
            // ModalManager never raises a later modal, so without this the picker opens behind the
            // cart and the tap looks like it did nothing. modal + 1 rather than the 1350 nested
            // drawers use: BranchDetailsSheet already sits at 1350 inside this picker and must
            // stay above it.
            sx={{ zIndex: (theme) => theme.zIndex.modal + 1 }}
            PaperProps={{
                sx: {
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                    maxWidth: { sm: 500 },
                    mx: { sm: "auto" },
                    // The map fills the sheet rather than sitting in a 260px strip inside a
                    // scrolling column, so the sheet itself is a fixed height and never scrolls.
                    height: mapMode ? "85vh" : undefined,
                    maxHeight: "90vh",
                    overflow: "hidden",
                },
            }}
            // PC: one dialog, the list column beside the map (or the list alone without a Maps key).
            desktop={{
                placement: "center",
                width: mapMode ? 1080 : 480,
                height: mapMode ? "min(720px, 90vh)" : undefined,
                paperSx: mapMode ? { backgroundColor: "#fffcf8", overflow: "hidden" } : { backgroundColor: "#fffcf8" },
            }}
        >
            {(presentation) => (presentation === "sheet" ? sheetTree : renderDialog())}
        </CustomerSheet>
    );
}
