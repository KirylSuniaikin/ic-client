// Pins the web-only `paymentChoice` namespace registration: both locale bundles and the `ns` list.
// A namespace missing from `ns` silently 404s every lookup at runtime. Web-only on purpose: the
// mobile repo byte-compares `cart`, `payment` and the other customer namespaces against these
// files, so the cart's new invitation could not go there.
import { describe, it, expect } from "@jest/globals";
import i18n, { resources } from "./index";
import enPaymentChoice from "./locales/en/paymentChoice.json";
import arPaymentChoice from "./locales/ar/paymentChoice.json";

function keyTree(value: unknown, prefix = ""): string[] {
    if (typeof value !== "object" || value === null) return [prefix];
    return Object.entries(value).flatMap(([key, child]) => keyTree(child, prefix ? `${prefix}.${key}` : key));
}

describe("i18n paymentChoice namespace registration", () => {
    it("registers the paymentChoice namespace in the English resource bundle", () => {
        expect(resources.en.paymentChoice).toEqual(enPaymentChoice);
    });

    it("registers the paymentChoice namespace in the Arabic resource bundle", () => {
        expect(resources.ar.paymentChoice).toEqual(arPaymentChoice);
    });

    it("includes paymentChoice in the list of namespaces i18next loads", () => {
        expect(i18n.options.ns).toContain("paymentChoice");
    });

    it("keeps identical key trees in English and Arabic", () => {
        expect(keyTree(arPaymentChoice).sort()).toEqual(keyTree(enPaymentChoice).sort());
    });
});
