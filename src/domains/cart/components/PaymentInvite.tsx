import { useTranslation } from "react-i18next";
import { Box, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { BRAND_RED } from "../../../shared/utils/theme";

// The owner's speech bubble (option A, 18 Oct 2026) announcing the new payment methods. It pointed
// down the cart's margin at the payment row; since the methods moved to the payment page (19 Oct
// 2026) it sits above their list there, its tail pointing at it.

const BUBBLE_SX = {
    position: "relative",
    width: "fit-content",
    maxWidth: 270,
    // Room under the bubble for its tail.
    mb: 2.5,
    px: 2,
    py: 1.5,
    borderRadius: "18px",
    backgroundColor: BRAND_RED,
    color: "#fff",
    fontSize: "14px",
    fontWeight: 600,
    lineHeight: 1.35,
    boxShadow: `0 6px 18px ${alpha(BRAND_RED, 0.35)}`,
    // The tail: a square turned 45° under the bubble's starting corner, pointing at the list.
    "&::after": {
        content: '""',
        position: "absolute",
        left: 22,
        bottom: -7,
        width: 14,
        height: 14,
        borderRadius: "2px",
        backgroundColor: BRAND_RED,
        transform: "rotate(45deg)",
    },
} satisfies SxProps<Theme>;

export function PaymentInviteBubble(): JSX.Element {
    const { t } = useTranslation("paymentChoice");
    return (
        <Typography data-testid="payment-invite-bubble" sx={BUBBLE_SX}>
            <Box component="span" aria-hidden sx={{ fontSize: "16px", mr: 0.5 }}>✨</Box>
            {t("newMethodsInvite")}
        </Typography>
    );
}
