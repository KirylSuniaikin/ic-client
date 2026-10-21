import { useEffect, useRef } from "react";
import { Box } from "@mui/material";
import { useTranslation } from "react-i18next";
import { PAY_BUTTON_HEIGHT, PAY_BUTTON_RADIUS, PAY_BUTTON_SLOT_SX } from "../../cart/components/CartChrome";

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
// offered once useApplePayCapability has fetched it). Apple's guidelines forbid redrawing it. Its
// size, corner and slot are the payment page's own red button's, so the two read as one family.
export function ApplePayButton({ onClick, disabled = false }: Props): JSX.Element {
    const { t, i18n } = useTranslation("applePay");
    const label = t("button.label");
    const appleButtonRef = useRef<HTMLElement>(null);

    // Apple's component stops every click at its own host (apple-pay-button.js, connectedCallback:
    // addEventListener("click", e => e.stopPropagation())), so the click never bubbles up to the root
    // where React 18 dispatches onClick: a React onClick on it never fires, and Apple Pay never
    // started outside Safari. stopPropagation does not stop the host's other listeners, so the tap
    // is bound on the host itself.
    useEffect(() => {
        const host = appleButtonRef.current;
        if (!host || disabled) return undefined;
        host.addEventListener("click", onClick);
        return () => host.removeEventListener("click", onClick);
    }, [onClick, disabled]);

    return (
        <Box sx={PAY_BUTTON_SLOT_SX}>
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
                        height: PAY_BUTTON_HEIGHT,
                        border: 0,
                        padding: 0,
                        borderRadius: `${PAY_BUTTON_RADIUS}px`,
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
                    ref={appleButtonRef}
                    buttonstyle="black"
                    type="buy"
                    locale={i18n.language === "ar" ? "ar-AB" : "en-US"}
                    role="button"
                    aria-label={label}
                    aria-disabled={disabled}
                    style={{
                        display: "block",
                        width: "100%",
                        height: `${PAY_BUTTON_HEIGHT}px`,
                        opacity: disabled ? 0.5 : 1,
                        "--apple-pay-button-width": "100%",
                        "--apple-pay-button-height": `${PAY_BUTTON_HEIGHT}px`,
                        "--apple-pay-button-border-radius": `${PAY_BUTTON_RADIUS}px`,
                    }}
                />
            )}
        </Box>
    );
}
