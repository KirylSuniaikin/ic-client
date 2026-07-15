// Pins the first-visit language choice: a customer whose browser is Arabic must land on the
// Arabic site without touching anything, and everyone else must land on English. The behaviour
// comes from i18next-browser-languagedetector's config in ./index.ts (detection order
// localStorage -> navigator, fallbackLng "en", nonExplicitSupportedLngs), so it is only
// exercised at module-init time -- hence the isolateModules + dynamic import below rather than
// importing the already-initialized singleton.
import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";

const NAVIGATOR_LANGUAGE = Object.getOwnPropertyDescriptor(window.navigator, "language");
const NAVIGATOR_LANGUAGES = Object.getOwnPropertyDescriptor(window.navigator, "languages");

// jsdom's navigator.language is a read-only getter, so it has to be redefined rather than assigned.
// The detector reads `languages` first and falls back to `language`; both are set to keep them consistent.
function setBrowserLanguage(language: string): void {
    Object.defineProperty(window.navigator, "language", { value: language, configurable: true });
    Object.defineProperty(window.navigator, "languages", { value: [language], configurable: true });
}

// The i18n module initializes as a side effect of being imported, and detection runs exactly once
// at that moment -- so each case needs a fresh module registry to re-run it against new inputs.
// (jest.isolateModulesAsync does not exist in the Jest 27 that react-scripts pins, hence the
// explicit resetModules + re-import.)
async function initI18nFresh(): Promise<{ language: string; resolvedLanguage: string | undefined }> {
    jest.resetModules();
    const instance = (await import("./index")).default;
    return { language: instance.language, resolvedLanguage: instance.resolvedLanguage };
}

beforeEach(() => {
    localStorage.clear();
});

afterEach(() => {
    localStorage.clear();
    if (NAVIGATOR_LANGUAGE) Object.defineProperty(window.navigator, "language", NAVIGATOR_LANGUAGE);
    if (NAVIGATOR_LANGUAGES) Object.defineProperty(window.navigator, "languages", NAVIGATOR_LANGUAGES);
});

describe("i18n language detection — first visit (no stored preference)", () => {
    it("loads Arabic for an Arabic browser", async () => {
        setBrowserLanguage("ar");

        const { resolvedLanguage } = await initI18nFresh();

        expect(resolvedLanguage).toBe("ar");
    });

    it("loads Arabic for a regional Arabic browser such as ar-BH", async () => {
        setBrowserLanguage("ar-BH");

        const { resolvedLanguage } = await initI18nFresh();

        expect(resolvedLanguage).toBe("ar");
    });

    it("loads English for an English browser", async () => {
        setBrowserLanguage("en-US");

        const { resolvedLanguage } = await initI18nFresh();

        expect(resolvedLanguage).toBe("en");
    });

    it("falls back to English for an unsupported language", async () => {
        setBrowserLanguage("fr-FR");

        const { resolvedLanguage } = await initI18nFresh();

        expect(resolvedLanguage).toBe("en");
    });
});

describe("i18n language detection — a stored preference wins over the browser", () => {
    it("stays English when the customer chose English on an Arabic browser", async () => {
        setBrowserLanguage("ar-BH");
        localStorage.setItem("ic_lang", "en");

        const { resolvedLanguage } = await initI18nFresh();

        expect(resolvedLanguage).toBe("en");
    });

    it("stays Arabic when the customer chose Arabic on an English browser", async () => {
        setBrowserLanguage("en-US");
        localStorage.setItem("ic_lang", "ar");

        const { resolvedLanguage } = await initI18nFresh();

        expect(resolvedLanguage).toBe("ar");
    });
});
