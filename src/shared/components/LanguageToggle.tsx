import React from "react";
import {Box, Fab} from "@mui/material";
import type {SxProps, Theme} from "@mui/material";
import {useTranslation} from "react-i18next";

type Props = {
    sx?: SxProps<Theme>;
};

// One-tap switch between English and Arabic. This is an EXPLICIT customer choice, so it
// persists it to localStorage ("ic_lang") itself -- the detector no longer auto-caches
// (see i18n/index.ts), so a stored value now means "the customer deliberately picked this"
// and outranks the browser preference. The RTL direction flip is handled in AppProviders.
export function LanguageToggle({sx}: Props): JSX.Element {
    const {t, i18n} = useTranslation();
    const isArabic = i18n.language.startsWith("ar");
    const nextLanguage = isArabic ? "en" : "ar";
    const label = isArabic ? t("language.switchToEnglish") : t("language.switchToArabic");

    function handleToggle(): void {
        void i18n.changeLanguage(nextLanguage);
        localStorage.setItem("ic_lang", nextLanguage);
    }

    return (
        <Fab
            size="medium"
            aria-label="toggle language"
            onClick={handleToggle}
            sx={{
                p: 0,
                minHeight: "unset",
                minWidth: "unset",
                width: 40,
                height: 40,
                borderRadius: "50%",
                boxShadow: "none",
                fontWeight: 700,
                backgroundColor: "#fff",
                ...sx,
            }}
        >
            <Box
                component="span"
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "100%",
                    height: "100%",
                    lineHeight: 1,
                    // Optical centering: the glyph isn't centered within its font
                    // line box, and "ع" vs "EN" sit differently — nudge each so the
                    // top/bottom gap inside the circle looks even.
                    transform: isArabic ? "translateY(1px)" : "translateY(0.5px)",
                }}
            >
                {label}
            </Box>
        </Fab>
    );
}
