// Verifies the `kiosk` namespace was registered in every place the other 7 namespaces are
// (task-spec.md §14 "shared/i18n/index.ts" edit): the two locale bundles and the `ns` array.
// A namespace missing from `ns` silently 404s every `t("kiosk:...")` lookup at runtime instead of
// failing a build, so this is worth pinning explicitly rather than trusting the diff by eye.
import { describe, it, expect } from "@jest/globals";
import i18n, { resources } from "./index";
import enKiosk from "./locales/en/kiosk.json";
import arKiosk from "./locales/ar/kiosk.json";

describe("i18n kiosk namespace registration", () => {
    it("registers the kiosk namespace in the English resource bundle", () => {
        expect(resources.en.kiosk).toEqual(enKiosk);
    });

    it("registers the kiosk namespace in the Arabic resource bundle", () => {
        expect(resources.ar.kiosk).toEqual(arKiosk);
    });

    it("includes kiosk in the list of namespaces i18next loads", () => {
        expect(i18n.options.ns).toContain("kiosk");
    });

    it("does not duplicate the reused checkout phone-validation keys inside kiosk.json", () => {
        // task-spec.md §10: phone validation copy is reused from `checkout`
        // (clientInfo.errors.onlyDigits / clientInfo.errors.phoneLength) -- must not be redefined here.
        expect(enKiosk).not.toHaveProperty("clientInfo");
        expect(arKiosk).not.toHaveProperty("clientInfo");
    });

    it("groups the English kiosk copy under the documented top-level sections", () => {
        expect(Object.keys(enKiosk).sort()).toEqual(
            ["approved", "counter", "errors", "failure", "payment", "phone"].sort()
        );
    });

    it("keeps the Arabic bundle's key structure in sync with the English bundle", () => {
        expect(Object.keys(arKiosk).sort()).toEqual(Object.keys(enKiosk).sort());
    });
});
