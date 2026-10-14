// Pins the web-only `cardPayment` namespace registration: both locale bundles and the `ns` list.
// A namespace missing from `ns` silently 404s every lookup at runtime.
import { describe, it, expect } from "@jest/globals";
import i18n, { resources } from "./index";
import enCardPayment from "./locales/en/cardPayment.json";
import arCardPayment from "./locales/ar/cardPayment.json";

function keyTree(value: unknown, prefix = ""): string[] {
    if (typeof value !== "object" || value === null) return [prefix];
    return Object.entries(value).flatMap(([key, child]) => keyTree(child, prefix ? `${prefix}.${key}` : key));
}

describe("i18n cardPayment namespace registration", () => {
    it("registers the cardPayment namespace in the English resource bundle", () => {
        expect(resources.en.cardPayment).toEqual(enCardPayment);
    });

    it("registers the cardPayment namespace in the Arabic resource bundle", () => {
        expect(resources.ar.cardPayment).toEqual(arCardPayment);
    });

    it("includes cardPayment in the list of namespaces i18next loads", () => {
        expect(i18n.options.ns).toContain("cardPayment");
    });

    it("keeps identical key trees in English and Arabic", () => {
        expect(keyTree(arCardPayment).sort()).toEqual(keyTree(enCardPayment).sort());
    });
});
