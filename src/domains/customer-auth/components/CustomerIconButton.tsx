import React from "react";
import { useTranslation } from "react-i18next";
import { Fab } from "@mui/material";
import PersonAddAlt1RoundedIcon from "@mui/icons-material/PersonAddAlt1Rounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import { useCustomerAuth } from "../context/CustomerAuthProvider";
import { useCustomerAuthUi } from "../context/CustomerAuthUiProvider";

// Customer entry point rendered in HeroSection's top-right cluster.
// Logged-out: opens the centralized CustomerLoginPopup. Logged-in: opens the
// centralized CustomerProfilePopup. Thin trigger only — the popups themselves
// are mounted once, app-wide, via CustomerAuthModals (task-spec.md §5.6).
export function CustomerIconButton(): React.JSX.Element {
    const { t } = useTranslation("customerAuth");
    const { token } = useCustomerAuth();
    const { openLogin, openProfile } = useCustomerAuthUi();
    const isLoggedIn = token !== null;

    function handleClick(): void {
        if (isLoggedIn) {
            openProfile();
        } else {
            openLogin();
        }
    }

    return (
        <Fab
            size="medium"
            aria-label={isLoggedIn ? t("iconButton.account") : t("iconButton.login")}
            onClick={handleClick}
            sx={{
                p: 0,
                minHeight: "unset",
                minWidth: "unset",
                width: 40,
                height: 40,
                borderRadius: "50%",
                boxShadow: "none",
                backgroundColor: isLoggedIn ? "#E44B4C" : "#fff",
                color: isLoggedIn ? "#fff" : "#1A1A1A",
            }}
        >
            {isLoggedIn ? <PersonRoundedIcon /> : <PersonAddAlt1RoundedIcon />}
        </Fab>
    );
}

export default CustomerIconButton;
