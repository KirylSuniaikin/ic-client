import { describe, it, expect, afterEach } from "@jest/globals";
import { resolveCustomerLanguage } from "./customerLanguage";

const NAVIGATOR_LANGUAGE = Object.getOwnPropertyDescriptor(window.navigator, "language");
const NAVIGATOR_LANGUAGES = Object.getOwnPropertyDescriptor(window.navigator, "languages");

// jsdom's navigator.language is a read-only getter, so it has to be redefined rather than assigned
// -- mirrors src/shared/i18n/languageDetection.test.ts's setBrowserLanguage helper.
function setBrowserLanguages(languages: string[]): void {
    Object.defineProperty(window.navigator, "language", { value: languages[0], configurable: true });
    Object.defineProperty(window.navigator, "languages", { value: languages, configurable: true });
}

afterEach(() => {
    if (NAVIGATOR_LANGUAGE) Object.defineProperty(window.navigator, "language", NAVIGATOR_LANGUAGE);
    if (NAVIGATOR_LANGUAGES) Object.defineProperty(window.navigator, "languages", NAVIGATOR_LANGUAGES);
});

describe("resolveCustomerLanguage", () => {
    it("returns 'ar' when the app language is Arabic", () => {
        setBrowserLanguages(["en-US"]);

        expect(resolveCustomerLanguage("ar")).toBe("ar");
    });

    it("returns 'ar' when the app language is a regional Arabic variant", () => {
        setBrowserLanguages(["en-US"]);

        expect(resolveCustomerLanguage("ar-BH")).toBe("ar");
    });

    it("returns 'ar' when the app language is English but the browser locale is Arabic", () => {
        setBrowserLanguages(["ar-SA"]);

        expect(resolveCustomerLanguage("en")).toBe("ar");
    });

    it("returns 'en' when both the app language and the browser locale are English", () => {
        setBrowserLanguages(["en-US"]);

        expect(resolveCustomerLanguage("en")).toBe("en");
    });

    it("ignores an Arabic navigator locale when includeNavigator is false", () => {
        setBrowserLanguages(["ar-SA"]);

        expect(resolveCustomerLanguage("en", false)).toBe("en");
    });

    it("still returns 'ar' from the app language alone when includeNavigator is false", () => {
        setBrowserLanguages(["en-US"]);

        expect(resolveCustomerLanguage("ar", false)).toBe("ar");
    });
});
