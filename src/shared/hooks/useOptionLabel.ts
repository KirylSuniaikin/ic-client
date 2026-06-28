import {useCallback} from "react";
import {useTranslation} from "react-i18next";

// Maps a canonical English dough/crust option value to its menu-namespace translation key.
// The English value is the source of truth (drives the isThinDough/isGarlicCrust flags and the
// order payload) — only the DISPLAY label is localized, never the stored value.
const OPTION_KEYS: Record<string, string> = {
    "Traditional": "traditional",
    "Thin": "thin",
    "Traditional Dough": "traditionalDough",
    "Thin Dough": "thinDough",
    "Classic Crust": "classicCrust",
    "Garlic Crust": "garlicCrust",
};

// DISPLAY ONLY. Returns the localized label for a dough/crust option, falling back to the raw
// English value for anything unmapped (or when the Arabic key is empty → i18n falls back to en).
export function useOptionLabel(): (value: string) => string {
    const {t} = useTranslation("menu");
    return useCallback(
        (value: string): string => {
            const key = OPTION_KEYS[value];
            return key ? t(`options.${key}`) : value;
        },
        [t],
    );
}
