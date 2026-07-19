import i18n from "i18next";
import {initReactI18next} from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import enCommon from "./locales/en/common.json";
import enHome from "./locales/en/home.json";
import enMenu from "./locales/en/menu.json";
import enCart from "./locales/en/cart.json";
import enCheckout from "./locales/en/checkout.json";
import enSchedule from "./locales/en/schedule.json";
import enCustomerAuth from "./locales/en/customerAuth.json";

import arCommon from "./locales/ar/common.json";
import arHome from "./locales/ar/home.json";
import arMenu from "./locales/ar/menu.json";
import arCart from "./locales/ar/cart.json";
import arCheckout from "./locales/ar/checkout.json";
import arSchedule from "./locales/ar/schedule.json";
import arCustomerAuth from "./locales/ar/customerAuth.json";

// Namespaces map to domains. Add a new domain → add `<lng>/<domain>.json` here.
export const resources = {
    en: {common: enCommon, home: enHome, menu: enMenu, cart: enCart, checkout: enCheckout, schedule: enSchedule, customerAuth: enCustomerAuth},
    ar: {common: arCommon, home: arHome, menu: arMenu, cart: arCart, checkout: arCheckout, schedule: arSchedule, customerAuth: arCustomerAuth},
} as const;

export const SUPPORTED_LANGUAGES = ["en", "ar"] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

// The language every customer starts in unless the browser (or a stored choice) says otherwise.
// Also the language a shared kiosk tab is reset to between customers -- see useCheckout.
export const DEFAULT_LANGUAGE: AppLanguage = "en";

void i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources,
        fallbackLng: DEFAULT_LANGUAGE,
        supportedLngs: [...SUPPORTED_LANGUAGES],
        nonExplicitSupportedLngs: true, // treat "ar-BH" etc. as "ar"
        ns: ["common", "home", "menu", "cart", "checkout", "schedule", "customerAuth"],
        defaultNS: "common",
        interpolation: {escapeValue: false}, // React already escapes
        // Untranslated Arabic keys are left as "" placeholders for the team to fill;
        // an empty value is treated as missing and falls back to English (fallbackLng).
        returnEmptyString: false,
        detection: {
            // caches:[] disables auto-persistence. The detector must NOT cache the first-load
            // value, or a stale "ic_lang" from an old visit would outrank a freshly-changed
            // browser preference forever. (Note: the plugin DEFAULTS `caches` to ["localStorage"],
            // so it must be set to [] explicitly -- omitting the key re-enables caching.) navigator
            // is therefore re-read on every load. Only an EXPLICIT choice is persisted --
            // LanguageToggle and the kiosk reset write "ic_lang" themselves -- and localStorage
            // still comes first so that deliberate choice keeps winning over the browser.
            order: ["localStorage", "navigator"],
            lookupLocalStorage: "ic_lang",
            caches: [],
        },
        react: {useSuspense: false}, // resources are bundled, so no Suspense needed
    });

// English-pinned clone for staff-only screens (admin POS / login). Shares the same resource store
// but keeps its own language fixed to "en", so it never follows the customer's localStorage
// preference and the customer's language toggle never affects it. Used via LtrBoundary.
export const enI18n = i18n.cloneInstance({lng: "en"});

export default i18n;
