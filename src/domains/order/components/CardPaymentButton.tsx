import { Box, Button } from "@mui/material";
import { useTranslation } from "react-i18next";
import { BRAND_RED } from "../../../shared/utils/theme";

type Props = {
    onClick: () => void;
    disabled?: boolean;
};

// Outlined in brand red so it reads as a different action from the filled Checkout button and
// the Apple Pay button above it (DESIGN.md: brand red comes from BRAND_RED, never a new hex).
export function CardPaymentButton({ onClick, disabled = false }: Props): JSX.Element {
    const { t } = useTranslation("cardPayment");
    return (
        <Box sx={{ flexShrink: 0, px: 2, pb: 2 }}>
            <Button
                fullWidth
                variant="outlined"
                onClick={onClick}
                disabled={disabled}
                sx={{
                    height: 48, borderRadius: 4, textTransform: "none", fontWeight: 700,
                    color: BRAND_RED, borderColor: BRAND_RED, borderWidth: 2,
                    "&:hover": { borderColor: BRAND_RED, borderWidth: 2, bgcolor: "#FCE9E9" },
                }}
            >
                {t("button.label")}
            </Button>
        </Box>
    );
}
