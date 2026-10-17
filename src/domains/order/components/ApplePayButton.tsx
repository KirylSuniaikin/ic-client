import { Box } from "@mui/material";
import { useTranslation } from "react-i18next";

type Props = {
    onClick: () => void;
    disabled?: boolean;
};

// Safari draws its own button face through the -apple-pay-button appearance; no other browser
// knows that appearance and would render an empty box. Where `CSS.supports` cannot answer (old
// engines, jsdom) the native face is kept, as it always was.
function hasNativeApplePayButton(): boolean {
    if (typeof CSS === "undefined" || typeof CSS.supports !== "function") return true;
    return CSS.supports("-webkit-appearance", "-apple-pay-button");
}

// The button face is rendered by Safari itself via the -apple-pay-button appearance, or by
// Apple's <apple-pay-button> component elsewhere (the SDK is loaded by then: the button is only
// offered once useApplePayCapability has fetched it). Apple's guidelines forbid redrawing it.
export function ApplePayButton({ onClick, disabled = false }: Props): JSX.Element {
    const { t, i18n } = useTranslation("applePay");
    const label = t("button.label");
    return (
        <Box sx={{ flexShrink: 0, px: 2, pb: 2 }}>
            {hasNativeApplePayButton() ? (
                <Box
                    component="button"
                    type="button"
                    aria-label={label}
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
            ) : (
                // The component has no disabled state of its own, so a busy session both dims it
                // and drops the tap; the checkout hook's own re-entry guard stays the real lock.
                <apple-pay-button
                    buttonstyle="black"
                    type="buy"
                    locale={i18n.language === "ar" ? "ar-AB" : "en-US"}
                    role="button"
                    aria-label={label}
                    aria-disabled={disabled}
                    onClick={disabled ? undefined : onClick}
                    style={{
                        display: "block",
                        width: "100%",
                        height: "48px",
                        opacity: disabled ? 0.5 : 1,
                        "--apple-pay-button-width": "100%",
                        "--apple-pay-button-height": "48px",
                        "--apple-pay-button-border-radius": "16px",
                    }}
                />
            )}
        </Box>
    );
}
