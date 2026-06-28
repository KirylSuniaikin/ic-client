import {useCallback} from "react";
import {useTranslation} from "react-i18next";

type LocalizableItem = {
    name: string;
    name_ar?: string | null;
    description?: string;
    description_ar?: string | null;
};

type LocalizedItem = {
    /** Display name: Arabic when viewing in Arabic and an Arabic value exists, else English. */
    name: (item: LocalizableItem) => string;
    /** Display description: same fallback rule. */
    description: (item: LocalizableItem) => string;
};

// DISPLAY ONLY. Never feed the result back into a CartItem.name or the order payload — the
// backend resolves order items by their English name and the kitchen/admin board renders the
// linked MenuItem's English name. Localizing the canonical value would break order matching.
export function useLocalizedItem(): LocalizedItem {
    const {i18n} = useTranslation();
    const isArabic = i18n.language.startsWith("ar");

    const name = useCallback(
        (item: LocalizableItem): string => (isArabic && item.name_ar ? item.name_ar : item.name),
        [isArabic],
    );

    const description = useCallback(
        (item: LocalizableItem): string =>
            (isArabic && item.description_ar ? item.description_ar : item.description ?? ""),
        [isArabic],
    );

    return {name, description};
}
