// Raw spec's Image #1 (this prompt) -- benefits list + single CTA, dismissible;
// the last-3-orders profile popup (Image #2) is out of scope (§10). Brand-red
// styling mirroring ClientInfoPopup/PickUpReminderPopup/CustomerLoginPopup.
// Converted from Modal to a bottom Drawer per CashInputDrawer.tsx (task-spec.md §6.5 step 5),
// and no longer renders a nested CustomerLoginPopup -- it calls the centralized
// openLogin(phone) from useCustomerAuthUi() instead.
import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Box, Button, Drawer, IconButton, List, ListItem, ListItemIcon, ListItemText, Typography } from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import { useCustomerAuth } from "../../customer-auth/context/CustomerAuthProvider";
import { useCustomerAuthUi } from "../../customer-auth/context/CustomerAuthUiProvider";

const brandRed = "#E44B4C";

// Benefit copy lives in the checkout namespace (guestPrompt.benefits.*); these
// keys drive the rendered list order.
const BENEFIT_KEYS = ["noRefill", "threeClicks", "tracking", "history"] as const;

type Props = {
    open: boolean;
    phone: string;
    onDismiss: () => void;
};

// Post-order account-creation prompt (task-spec.md §4 req. 12/13, §6.5). Shown on the menu
// page (via HomePageModals) right after a guest places an order, prefilled with that order's
// phone; the redirect to the tracking page is deferred until this prompt is resolved. The CTA
// opens the single centralized CustomerLoginPopup via openLogin(phone); dismissing it (via
// "No thanks", the close icon, or its own login succeeding) calls onDismiss -- the caller
// (useCheckout.resolvePostOrderProposal) then navigates to the tracking page.
export function GuestAccountPromptPopup({ open, phone, onDismiss }: Props): React.JSX.Element {
    const { t } = useTranslation("checkout");
    const { token } = useCustomerAuth();
    const { openLogin } = useCustomerAuthUi();
    // Tracks whether THIS prompt initiated a login, so it only auto-dismisses itself when
    // its own CTA's login succeeds -- not when the hero CustomerIconButton's login happens
    // to succeed while this prompt is also open (task-spec.md §7 edge case).
    const loginInitiatedRef = useRef(false);

    // Reset the guard whenever this prompt is (re)opened, so a previous attempt's state
    // doesn't leak into the next render of this prompt.
    useEffect(() => {
        if (open) {
            loginInitiatedRef.current = false;
        }
    }, [open]);

    // Auto-dismiss once a login this prompt initiated succeeds. The centralized
    // CustomerLoginPopup closes itself independently via its own onClose()/closeAll() call.
    useEffect(() => {
        if (loginInitiatedRef.current && token !== null) {
            loginInitiatedRef.current = false;
            onDismiss();
        }
    }, [token, onDismiss]);

    function handleCtaClick(): void {
        loginInitiatedRef.current = true;
        openLogin(phone);
    }

    return (
        <Drawer
            anchor="bottom"
            open={open}
            onClose={onDismiss}
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
                <Box sx={{ width: 40, height: 4, bgcolor: "grey.300", borderRadius: 2, mx: "auto", mb: 2 }} />

                <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                    <IconButton onClick={onDismiss} size="small" aria-label={t("guestPrompt.dismiss")}>
                        <CloseRoundedIcon />
                    </IconButton>
                </Box>

                <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>
                    {t("guestPrompt.title")}
                </Typography>
                <Typography sx={{ mb: 2, color: "#666", fontSize: 14 }}>
                    {t("guestPrompt.subtitle")}
                </Typography>

                <List sx={{ mb: 2 }} dense>
                    {BENEFIT_KEYS.map((key) => (
                        <ListItem key={key} disableGutters sx={{ py: 0.5 }}>
                            <ListItemIcon sx={{ minWidth: 32 }}>
                                <CheckCircleRoundedIcon sx={{ fontSize: 20, color: brandRed }} />
                            </ListItemIcon>
                            <ListItemText primary={t(`guestPrompt.benefits.${key}`)} />
                        </ListItem>
                    ))}
                </List>

                <Button
                    fullWidth
                    variant="contained"
                    onClick={handleCtaClick}
                    sx={{
                        backgroundColor: brandRed,
                        color: "#fff",
                        textTransform: "none",
                        fontSize: "1rem",
                        borderRadius: 4,
                        "&:hover": { backgroundColor: "#d23f40" },
                    }}
                >
                    {t("guestPrompt.cta")}
                </Button>

                <Button
                    fullWidth
                    onClick={onDismiss}
                    sx={{ mt: 1, textTransform: "none", color: "#666" }}
                >
                    {t("guestPrompt.continueAsGuest")}
                </Button>
            </Box>
        </Drawer>
    );
}

export default GuestAccountPromptPopup;
