import React, { useEffect } from "react";
import { Box, Button, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { ReviewPrompt, ReviewPromptOutcome } from "../types";
import { CustomerSheet } from "../../../shared/components/CustomerSheet";
import type { CustomerSheetDesktop } from "../../../shared/components/CustomerSheet";
import { SheetHandle } from "../../delivery/components/sheetStyles";

// Post-order Google review ask. Follows the house bottom-drawer convention
// (MUI `Drawer anchor="bottom"`, rounded top corners 16, grey drag-handle pill,
// p:3 pb:4, sm max-width) — canonical reference
// domains/management/cash-register/components/CashInputDrawer.tsx.
//
// Exactly three actions and NO sentiment fork: there is deliberately no
// "how was it? 👍/👎" step deciding whether the Google link appears. Showing the
// review link only to customers you believe are happy is "review gating" —
// prohibited by Google's Maps content policy and by the FTC's Consumer Reviews
// Rule, and it puts the business listing at risk. The headline may ask how the
// pizza was; the answer must never gate the link. For the same reason the copy
// never asks for a rating or a star count.
//
// "Don't ask me again" sits beside "Not now" with equal weight rather than
// buried: we can never verify that a customer actually left a review (Google
// gives no callback), so an honest opt-out is what keeps the ask from becoming
// nagging.

// PC: a centred 420px dialog.
const REVIEW_DESKTOP = {
    placement: "center",
    width: 420,
    paperSx: { backgroundColor: "#fff" },
} satisfies CustomerSheetDesktop;

type Props = {
    prompt: ReviewPrompt | null;
    // Reported the moment the drawer is on screen, before any button is pressed.
    onShown: () => void;
    onAnswer: (outcome: Exclude<ReviewPromptOutcome, "SHOWN">) => void;
};

export function ReviewPromptDrawer({ prompt, onShown, onAnswer }: Props): React.JSX.Element | null {
    const { t } = useTranslation("customerAuth");

    useEffect(() => {
        if (prompt) {
            onShown();
        }
    }, [prompt, onShown]);

    if (!prompt) {
        return null;
    }

    const openReview = (): void => {
        // Answer first: the customer has decided, and this navigates away. Losing
        // the ack would mean asking them again.
        onAnswer("OPENED");
        window.open(prompt.reviewUrl, "_blank", "noopener,noreferrer");
    };

    return (
        <CustomerSheet
            open
            onClose={() => onAnswer("DISMISSED")}
            desktop={REVIEW_DESKTOP}
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

                <Typography sx={{ fontSize: 40, textAlign: "center", lineHeight: 1 }}>🍕</Typography>

                <Typography variant="h6" fontWeight="bold" sx={{ mt: 1, textAlign: "center" }}>
                    {t("reviewPrompt.title")}
                </Typography>

                <Typography sx={{ mt: 1, mb: 3, textAlign: "center", color: "text.secondary" }}>
                    {t("reviewPrompt.body")}
                </Typography>

                <Button
                    fullWidth
                    variant="contained"
                    onClick={openReview}
                    sx={{
                        borderRadius: 8,
                        py: 1.5,
                        fontWeight: "bold",
                        textTransform: "none",
                        bgcolor: "#E44B4C",
                        color: "#fff",
                        "&:hover": { bgcolor: "#d23c3d" },
                    }}
                >
                    {t("reviewPrompt.open")}
                </Button>

                <Button
                    fullWidth
                    onClick={() => onAnswer("DISMISSED")}
                    sx={{ mt: 1, color: "text.secondary" }}
                >
                    {t("reviewPrompt.later")}
                </Button>

                <Button
                    fullWidth
                    onClick={() => onAnswer("OPTED_OUT")}
                    sx={{ color: "text.secondary", textDecoration: "underline" }}
                >
                    {t("reviewPrompt.never")}
                </Button>
            </Box>
        </CustomerSheet>
    );
}

export default ReviewPromptDrawer;
