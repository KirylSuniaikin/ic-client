// Pins the web-only `applePay` namespace registration (task-spec.md F5.7, D3=a): both locale
// bundles and the `ns` list. A namespace missing from `ns` silently 404s every lookup at runtime.
import { describe, it, expect } from "@jest/globals";
import i18n, { resources } from "./index";
import enApplePay from "./locales/en/applePay.json";
import arApplePay from "./locales/ar/applePay.json";

function keyTree(value: unknown, prefix = ""): string[] {
    if (typeof value !== "object" || value === null) return [prefix];
    return Object.entries(value).flatMap(([key, child]) => keyTree(child, prefix ? `${prefix}.${key}` : key));
}

describe("i18n applePay namespace registration", () => {
    it("registers the applePay namespace in the English resource bundle", () => {
        expect(resources.en.applePay).toEqual(enApplePay);
    });

    it("registers the applePay namespace in the Arabic resource bundle", () => {
        expect(resources.ar.applePay).toEqual(arApplePay);
    });

    it("includes applePay in the list of namespaces i18next loads", () => {
        expect(i18n.options.ns).toContain("applePay");
    });

    it("keeps identical key trees in English and Arabic", () => {
        expect(keyTree(arApplePay).sort()).toEqual(keyTree(enApplePay).sort());
    });
});
