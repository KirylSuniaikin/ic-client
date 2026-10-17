import { Box, Button, CircularProgress, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { IBranch } from "../../management/inventory/types";
import { branchDisplayName } from "../utils/branchDisplayName";
import { CustomerSheet } from "../../../shared/components/CustomerSheet";
import type { CustomerSheetDesktop } from "../../../shared/components/CustomerSheet";
import { SheetHandle } from "../../delivery/components/sheetStyles";

// PC: a centred 440px dialog at the same modal + 1 as the phone sheet, so it still clears the cart.
const SWITCH_WARNING_DESKTOP = {
    placement: "center",
    width: 440,
    paperSx: { backgroundColor: "#fff" },
} satisfies CustomerSheetDesktop;

export interface BranchSwitchWarningDrawerProps {
    open: boolean;
    loading: boolean;
    targetBranch: IBranch | null;
    unavailableNames: string[];
    error: string | null;
    onConfirm: () => void;
    onCancel: () => void;
}

/**
 * Cart-loss warning shown when a customer switches branches mid-session with items already in
 * the cart (task-spec.md §6.4). Follows the CashInputDrawer anchor="bottom" convention. Names the
 * lines that would be dropped BEFORE switching so the customer can cancel instead of losing them
 * silently; on confirm only those named lines are removed, never the whole cart.
 */
export function BranchSwitchWarningDrawer({
    open, loading, targetBranch, unavailableNames, error, onConfirm, onCancel,
}: BranchSwitchWarningDrawerProps): JSX.Element {
    const { t, i18n } = useTranslation("branch");
    const branchName = targetBranch === null ? "" : branchDisplayName(targetBranch, i18n.language);

    return (
        <CustomerSheet
            open={open}
            onClose={onCancel}
            desktop={SWITCH_WARNING_DESKTOP}
            // A switch started from the cart's "Pick up from" card always has items, so this
            // warning opens over the still-open cart — a MUI Modal at theme.zIndex.modal (1300),
            // above a Drawer's default zIndex.drawer (1200). Without this the warning takes focus
            // while painting invisibly behind the cart.
            sx={{ zIndex: (theme) => theme.zIndex.modal + 1 }}
            PaperProps={{
                sx: {
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                    maxWidth: { sm: 500 },
                    mx: { sm: "auto" },
                },
            }}
        >
            <Box sx={{ p: 3, pb: 4 }}>
                <SheetHandle />

                <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
                    {t("switchWarning.title", { branchName })}
                </Typography>

                {loading && (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
                        <CircularProgress size={28} aria-label={t("switchWarning.loading")} />
                    </Box>
                )}

                {!loading && error && (
                    <Typography sx={{ color: "#E44B4C", mb: 3 }}>
                        {t("switchWarning.error", { message: error })}
                    </Typography>
                )}

                {!loading && !error && unavailableNames.length > 0 && (
                    <>
                        <Typography sx={{ mb: 1 }}>{t("switchWarning.itemsLost", { branchName })}</Typography>
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 3 }}>
                            {unavailableNames.map((name) => (
                                <Box
                                    key={name}
                                    data-testid="branch-switch-unavailable-item"
                                    sx={{ px: 2, py: 0.75, borderRadius: 999, backgroundColor: "#FFF3F3", border: "1px solid #F5C2C2" }}
                                >
                                    <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#E44B4C" }}>{name}</Typography>
                                </Box>
                            ))}
                        </Box>
                    </>
                )}

                {!loading && !error && unavailableNames.length === 0 && (
                    <Typography sx={{ mb: 3 }}>{t("switchWarning.noItemsLost", { branchName })}</Typography>
                )}

                {!error && (
                    <Button
                        fullWidth
                        variant="contained"
                        disabled={loading}
                        onClick={onConfirm}
                        sx={{
                            borderRadius: 3, py: 1.5, mb: 1.5, bgcolor: "#E44B4C", color: "white",
                            boxShadow: "none", "&:hover": { bgcolor: "#c73c3d", boxShadow: "none" },
                        }}
                    >
                        {t("switchWarning.confirm")}
                    </Button>
                )}

                <Button
                    fullWidth
                    variant="outlined"
                    onClick={onCancel}
                    sx={{ borderRadius: 3, py: 1.5, color: "#1A1A1A", borderColor: "grey.300", boxShadow: "none" }}
                >
                    {t("switchWarning.cancel")}
                </Button>
            </Box>
        </CustomerSheet>
    );
}
