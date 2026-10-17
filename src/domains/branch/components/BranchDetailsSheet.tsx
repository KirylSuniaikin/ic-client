import { useTranslation } from "react-i18next";
import { Box, Button, Chip, CircularProgress, Drawer, Typography } from "@mui/material";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import { useBranchDetails } from "../hooks/useBranchDetails";
import { BRAND_RED } from "./BranchListView";
import type { CartItem } from "../../menu/types";
import type { IBranch } from "../../management/inventory/types";

/** Universal cross-platform deep link: opens the native app where there is one, the web map otherwise. */
function routeUrl(branch: IBranch): string | null {
    if (branch.latitude === null || branch.longitude === null) return null;
    return `https://www.google.com/maps/dir/?api=1&destination=${branch.latitude},${branch.longitude}`;
}

export interface BranchDetailsSheetProps {
    /** Null keeps the sheet shut; a branch opens it and is what the details describe. */
    branch: IBranch | null;
    /** Drives the availability line. Pass the live cart — an empty one hides that line entirely. */
    cartItems: CartItem[];
    onClose: () => void;
    /** "Order here" — the branch is only chosen at this point, never on the map tap itself. */
    onConfirm: (branch: IBranch) => void;
}

/**
 * The sheet between tapping a branch and choosing it.
 *
 * Tapping a pin used to select the branch outright, which gave the customer nothing to decide
 * with — and, mid-session with a full cart, dropped them straight onto a cart-loss warning. This
 * shows what they are picking first: where it is, whether it is open, how to get there, and
 * whether their cart survives the move.
 *
 * It only reports. Choosing still runs the caller's existing flow, so the cart-loss confirmation
 * stays exactly where it was — this sheet warns, it does not consent on the customer's behalf.
 */
export function BranchDetailsSheet({ branch, cartItems, onClose, onConfirm }: BranchDetailsSheetProps): JSX.Element {
    const { t } = useTranslation("branch");
    const { loading, closingTime, unavailableNames, error } = useBranchDetails(branch, cartItems);

    const mapsUrl = branch === null ? null : routeUrl(branch);

    return (
        <Drawer
            anchor="bottom"
            open={branch !== null}
            onClose={onClose}
            // This sheet is opened from INSIDE BranchPickerDrawer, i.e. one MUI Drawer on top of
            // another. MUI does not raise a nested modal: ModalManager only manages `aria-hidden`
            // and the scroll lock, never z-index. The picker sits at theme.zIndex.modal + 1 (1301)
            // so it clears the cart Modal it can be opened from, and this sheet must stay above
            // that. The rest of this app never leaves stacking to chance — CashInputDrawer,
            // UnpaidInvoicesDrawer, BanCstmrDrawer and ShiftPopup all declare 1350 for exactly
            // this reason.
            sx={{zIndex: 1350}}
            PaperProps={{
                sx: {
                    borderTopLeftRadius: { xs: 20, sm: 28 },
                    borderTopRightRadius: { xs: 20, sm: 28 },
                    maxWidth: { sm: 500 },
                    mx: { sm: "auto" },
                    maxHeight: "85vh",
                    backgroundColor: "#fffcf8",
                    backgroundImage: "none",
                },
            }}
        >
            <Box sx={{ p: 3, pb: 4, overflowY: "auto" }}>
                <Box sx={{ width: 40, height: 4, bgcolor: "grey.300", borderRadius: 2, mx: "auto", mb: 2 }} />

                <Typography variant="h5" sx={{ fontWeight: 700, textAlign: "center" }}>
                    {branch?.branchName ?? ""}
                </Typography>
                <Typography variant="body2" sx={{ color: "#8a807a", textAlign: "center", mt: 0.5, mb: 2.5 }}>
                    {branch?.address ?? t("details.noAddress")}
                </Typography>

                {/* Hours and route sit on one line, as two equal affordances — neither is the
                    action the sheet is here for. */}
                <Box sx={{ display: "flex", gap: 1, justifyContent: "center", flexWrap: "wrap", mb: 2.5 }}>
                    <Chip
                        icon={loading
                            ? <CircularProgress size={14} sx={{ color: BRAND_RED }} />
                            : <AccessTimeRoundedIcon sx={{ color: `${BRAND_RED} !important` }} />}
                        label={closingTime === null
                            ? t("details.closedNow")
                            : t("details.openUntil", { time: closingTime })}
                        sx={{ backgroundColor: "#fff", border: "1px solid #f1eae4", fontWeight: 600,
                              py: 2.2, px: 0.5, borderRadius: 999 }}
                    />
                    {mapsUrl !== null && (
                        <Chip
                            component="a"
                            href={mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            clickable
                            icon={<PlaceRoundedIcon sx={{ color: `${BRAND_RED} !important` }} />}
                            label={t("details.route")}
                            sx={{ backgroundColor: "#fff", border: "1px solid #f1eae4", fontWeight: 600,
                                  py: 2.2, px: 0.5, borderRadius: 999 }}
                        />
                    )}
                </Box>

                {/* Only ever shown with something in the cart: told to an empty-cart customer it
                    is noise, and told wrongly it is a promise we break one screen later. */}
                {cartItems.length > 0 && branch !== null && (
                    <Box sx={{ backgroundColor: "#fff", border: "1px solid #f1eae4", borderRadius: 4,
                               p: 2, mb: 2.5 }}>
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
                                {t("switchWarning.noItemsLost", { branchName: branch.branchName })}
                            </Typography>
                        ) : (
                            <>
                                <Typography variant="body2" sx={{ color: "#8a5a00", fontWeight: 600, mb: 0.5 }}>
                                    {t("switchWarning.itemsLost", { branchName: branch.branchName })}
                                </Typography>
                                {unavailableNames.map((name) => (
                                    <Typography
                                        key={name}
                                        variant="body2"
                                        data-testid="branch-details-unavailable-item"
                                        sx={{ color: "#3b352c" }}
                                    >
                                        • {name}
                                    </Typography>
                                ))}
                            </>
                        )}
                    </Box>
                )}

                <Button
                    variant="contained"
                    onClick={() => { if (branch !== null) onConfirm(branch); }}
                    sx={{
                        backgroundColor: BRAND_RED, color: "#fff", textTransform: "none",
                        fontWeight: 700, fontSize: "1rem", borderRadius: 999, py: 1.5, width: "100%",
                        boxShadow: "none",
                        "&:hover": { backgroundColor: BRAND_RED, boxShadow: "none", filter: "brightness(0.94)" },
                    }}
                >
                    {t("details.orderHere")}
                </Button>
            </Box>
        </Drawer>
    );
}
