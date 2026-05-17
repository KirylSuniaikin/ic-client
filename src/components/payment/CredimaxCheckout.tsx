import { useEffect, useState } from "react";
import { Box, CircularProgress } from "@mui/material";

interface CredimaxCheckoutProps {
    sessionId: string;
    merchantId: string;
    orderId: number;
    onClose: () => void;
}

interface CheckoutDisplayControl {
    billingAddress: "HIDE" | "OPTIONAL" | "MANDATORY";
    customerEmail: "HIDE" | "OPTIONAL" | "MANDATORY";
}

// interface CheckoutInteraction {
//     operation: "PURCHASE" | "AUTHORIZE";
//     displayControl: CheckoutDisplayControl;
// }

interface CheckoutConfig {
    session: {
        id: string
    };
}

interface CheckoutGlobal {
    configure(options: CheckoutConfig): void;
    showPaymentPage(): void;
}

declare global {
    interface Window {
        Checkout?: CheckoutGlobal;
    }
}

const CHECKOUT_SCRIPT_ID = "credimax-checkout-js";
const CHECKOUT_SCRIPT_SRC = "https://credimax.gateway.mastercard.com/static/checkout/checkout.min.js";

function CredimaxCheckout({ sessionId, merchantId, onClose }: CredimaxCheckoutProps): JSX.Element {
    const [scriptLoaded, setScriptLoaded] = useState(
        // Skip loading if the script was already injected in a previous render
        () => !!document.getElementById(CHECKOUT_SCRIPT_ID) || window.Checkout !== undefined
    );
    const [scriptError, setScriptError] = useState(false);

    useEffect(() => {
        if (scriptLoaded) {
            return;
        }

        const script = document.createElement("script");
        // script.id = CHECKOUT_SCRIPT_ID;
        // script.async = true;
        script.src = CHECKOUT_SCRIPT_SRC;

        script.onload = (): void => {
            setScriptLoaded(true);
        };

        script.onerror = (): void => {
            setScriptError(true);
        };

        document.head.appendChild(script);
    }, []);

    useEffect(() => {
        if (scriptError) {
            onClose();
        }
    }, [scriptError, onClose]);

    useEffect(() => {
        if (!scriptLoaded) {
            return;
        }

        if (window.Checkout === undefined) {
            // Script loaded but Checkout global is missing — treat as load error
            onClose();
            return;
        }

        window.Checkout.configure({
            session:
                {
                    id: sessionId.toString()
                },
        });

        window.Checkout.showPaymentPage();
    }, [scriptLoaded, sessionId]);

    if (!scriptLoaded) {
        return (
            <Box
                sx={{
                    position: "fixed",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 9999,
                    backgroundColor: "rgba(255,255,255,0.8)",
                }}
            >
                <CircularProgress sx={{ color: "#E44B4C" }} />
            </Box>
        );
    }

    return <></>;
}

export default CredimaxCheckout;
