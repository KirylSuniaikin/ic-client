import React from "react";
import { useCustomerAuthUi } from "../context/CustomerAuthUiProvider";
import { CustomerLoginPopup } from "./CustomerLoginPopup";
import { CustomerProfilePopup } from "./CustomerProfilePopup";

// The single app-level mount point for CustomerLoginPopup/CustomerProfilePopup
// (task-spec.md §5.3) — rendered once in app/providers.tsx so both HomePage
// and OrderStatusPage share exactly one instance of each, driven entirely by
// CustomerAuthUiProvider's state. Both popups are always mounted with an
// `open` boolean, matching today's CustomerIconButton pattern.
export function CustomerAuthModals(): React.JSX.Element {
    const { isLoginOpen, isProfileOpen, loginPrefillPhone, loginPrefillName, loginCheckoutMode, closeAll } = useCustomerAuthUi();

    return (
        <>
            <CustomerLoginPopup
                open={isLoginOpen}
                onClose={closeAll}
                prefillPhone={loginPrefillPhone ?? undefined}
                prefillName={loginPrefillName ?? undefined}
                checkoutMode={loginCheckoutMode}
            />
            <CustomerProfilePopup open={isProfileOpen} onClose={closeAll} />
        </>
    );
}

export default CustomerAuthModals;
