import { describe, it, expect } from "@jest/globals";
import { countries, localizedCountryName } from "./countries";

describe("countries", () => {
    it("matches the original entries extracted from ClientInfoPopup, plus Arabic names", () => {
        expect(countries).toEqual([
            { name: "Bahrain", nameAr: "البحرين", code: "973", digits: 8 },
            { name: "Saudi Arabia", nameAr: "السعودية", code: "966", digits: 9 },
            { name: "Oman", nameAr: "عُمان", code: "968", digits: 8 },
            { name: "Kuwait", nameAr: "الكويت", code: "965", digits: 8 },
            { name: "United Arab Emirates", nameAr: "الإمارات العربية المتحدة", code: "971", digits: 9 },
            { name: "Egypt", nameAr: "مصر", code: "20", digits: 10 },
            { name: "Italy", nameAr: "إيطاليا", code: "39", digits: 10 },
            { name: "United Kingdom", nameAr: "المملكة المتحدة", code: "44", digits: 10 },
            { name: "United States", nameAr: "الولايات المتحدة", code: "1", digits: 10 },
            { name: "France", nameAr: "فرنسا", code: "33", digits: 9 },
            { name: "Poland", nameAr: "بولندا", code: "48", digits: 9 },
        ]);
    });

    describe("localizedCountryName", () => {
        it("returns the English name for non-Arabic languages", () => {
            expect(localizedCountryName(countries[0], "en")).toBe("Bahrain");
            expect(localizedCountryName(countries[0], "en-US")).toBe("Bahrain");
        });

        it("returns the Arabic name for Arabic languages (including regional variants)", () => {
            expect(localizedCountryName(countries[0], "ar")).toBe("البحرين");
            expect(localizedCountryName(countries[0], "ar-BH")).toBe("البحرين");
        });
    });
});
