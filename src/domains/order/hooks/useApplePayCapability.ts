import { useEffect, useState } from "react";
import { isApplePayCapable } from "../utils/applePayRequest";
import { detectApplePayCapability } from "../utils/applePaySdk";

/**
 * Whether this device can pay with Apple Pay, checked only once `active` (the customer opened the
 * cart) so a menu visit never fetches Apple's SDK.
 *
 * Starts from the synchronous native answer, so in Safari the button is there on the first
 * render exactly as before; elsewhere it turns on when the SDK has answered.
 */
export function useApplePayCapability(active: boolean): boolean {
    const [capable, setCapable] = useState<boolean>(isApplePayCapable);

    useEffect(() => {
        if (!active || capable) return;
        let cancelled = false;
        void detectApplePayCapability().then(result => {
            if (!cancelled && result) setCapable(true);
        });
        return () => { cancelled = true; };
    }, [active, capable]);

    return capable;
}
