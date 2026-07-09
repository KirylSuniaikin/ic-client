// Shared country list — single source of truth for the phone country-code
// selector used by ClientInfoPopup and CustomerLoginPopup. Extracted from
// ClientInfoPopup.tsx verbatim (task-spec-rebuild.md §5.5/§8 Phase B).

export type Country = {
    name: string;
    // Arabic display name, rendered in the country dropdown when the current UI
    // language is "ar". `name` (English) stays the stable identity/lookup key.
    nameAr: string;
    code: string;
    digits: number;
};

export const countries: Country[] = [
    {name: "Bahrain", nameAr: "البحرين", code: "973", digits: 8},
    {name: "Saudi Arabia", nameAr: "السعودية", code: "966", digits: 9},
    {name: "Oman", nameAr: "عُمان", code: "968", digits: 8 },
    {name: "Kuwait", nameAr: "الكويت", code: "965", digits: 8 },
    {name: "United Arab Emirates", nameAr: "الإمارات العربية المتحدة", code: "971", digits: 9 },
    {name: "Egypt", nameAr: "مصر", code: "20", digits: 10},
    {name: "Italy", nameAr: "إيطاليا", code: "39", digits: 10},
    {name: "United Kingdom", nameAr: "المملكة المتحدة", code: "44", digits: 10},
    {name: "United States", nameAr: "الولايات المتحدة", code: "1", digits: 10},
    {name: "France", nameAr: "فرنسا", code: "33", digits: 9},
    {name: "Poland", nameAr: "بولندا", code: "48", digits: 9},
    {name: "Czech Republic", nameAr: "جمهورية التشيك", code: "420", digits: 9}
];

// Picks the display name for the active UI language. English `name` is the
// fallback for any non-Arabic language.
export function localizedCountryName(country: Country, language: string): string {
    return language.startsWith("ar") ? country.nameAr : country.name;
}
