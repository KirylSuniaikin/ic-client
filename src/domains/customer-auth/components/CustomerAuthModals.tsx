import React from "react";
import { useCustomerAuthUi } from "../context/CustomerAuthUiProvider";
import { CustomerLoginPopup } from "./CustomerLoginPopup";
import { CustomerProfilePopup } from "./CustomerProfilePopup";
import { ReviewPromptDrawer } from "./ReviewPromptDrawer";
import { useReviewPrompt } from "../hooks/useReviewPrompt";

// The single app-level mount point for CustomerLoginPopup/CustomerProfilePopup
// (task-spec.md §5.3) — rendered once in app/providers.tsx so both HomePage
// and OrderStatusPage share exactly one instance of each, driven entirely by
// CustomerAuthUiProvider's state. Both popups are always mounted with an
// `open` boolean, matching today's CustomerIconButton pattern.
export function CustomerAuthModals(): React.JSX.Element {
    const {
        isLoginOpen,
        isProfileOpen,
        loginPrefillPhone,
        loginPrefillName,
        loginCheckoutMode,
        closeAll,
        isAnyCustomerAuthPopupOpen,
    } = useCustomerAuthUi();

    // Gated on the existing isAnyCustomerAuthPopupOpen rather than a new piece of
    // provider state: the review ask must never stack on top of the login or
    // profile sheet, and that flag already answers exactly that question.
    const { prompt, markShown, answer } = useReviewPrompt(!isAnyCustomerAuthPopupOpen);

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
            {/* Gated at render as well as at fetch: a prompt already loaded when the
                customer opens their profile must not stay on screen underneath it. */}
            <ReviewPromptDrawer
                prompt={isAnyCustomerAuthPopupOpen ? null : prompt}
                onShown={markShown}
                onAnswer={answer}
            />
        </>
    );
}

export default CustomerAuthModals;
