import { Box } from "@mui/material";
import { useTranslation } from "react-i18next";

type Props = {
    onClick: () => void;
    disabled?: boolean;
};

// The button face is rendered by Safari itself via the -apple-pay-button appearance; only the
// surrounding container copies CartComponent's checkout-button container (DESIGN.md is absent
// from this checkout, task-spec.md B1).
export function ApplePayButton({ onClick, disabled = false }: Props): JSX.Element {
    const { t } = useTranslation("applePay");
    return (
        <Box sx={{ flexShrink: 0, px: 2, pb: 2 }}>
            <Box
                component="button"
                type="button"
                aria-label={t("button.label")}
                onClick={onClick}
                disabled={disabled}
                sx={{
                    display: "block",
                    width: "100%",
                    height: 48,
                    border: 0,
                    padding: 0,
                    borderRadius: 4,
                    cursor: disabled ? "default" : "pointer",
                    opacity: disabled ? 0.5 : 1,
                    WebkitAppearance: "-apple-pay-button",
                    "-apple-pay-button-type": "buy",
                    "-apple-pay-button-style": "black",
                }}
            />
        </Box>
    );
}
