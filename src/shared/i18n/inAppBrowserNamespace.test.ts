// Pins the web-only `inAppBrowser` namespace registration: both locale bundles and the `ns` list.
// A namespace missing from `ns` silently 404s every lookup at runtime. Web-only on purpose: the
// mobile repo byte-compares `home`, `customerAuth` and the other customer namespaces against these
// files, and the native app has no in-app browser to escape from.
import { describe, it, expect } from "@jest/globals";
import i18n, { resources } from "./index";
import enInAppBrowser from "./locales/en/inAppBrowser.json";
import arInAppBrowser from "./locales/ar/inAppBrowser.json";

function keyTree(value: unknown, prefix = ""): string[] {
    if (typeof value !== "object" || value === null) return [prefix];
    return Object.entries(value).flatMap(([key, child]) => keyTree(child, prefix ? `${prefix}.${key}` : key));
}

describe("i18n inAppBrowser namespace registration", () => {
    it("registers the inAppBrowser namespace in the English resource bundle", () => {
        expect(resources.en.inAppBrowser).toEqual(enInAppBrowser);
    });

    it("registers the inAppBrowser namespace in the Arabic resource bundle", () => {
        expect(resources.ar.inAppBrowser).toEqual(arInAppBrowser);
    });

    it("includes inAppBrowser in the list of namespaces i18next loads", () => {
        expect(i18n.options.ns).toContain("inAppBrowser");
    });

    it("keeps identical key trees in English and Arabic", () => {
        expect(keyTree(arInAppBrowser).sort()).toEqual(keyTree(enInAppBrowser).sort());
    });
});
