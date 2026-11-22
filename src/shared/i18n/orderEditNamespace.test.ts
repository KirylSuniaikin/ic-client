// Pins the staff-only `orderEdit` namespace (order-board edit popup): both locale bundles and the
// `ns` list. A namespace missing from `ns` silently 404s every lookup at runtime.
import { describe, it, expect } from "@jest/globals";
import i18n, { resources } from "./index";
import enOrderEdit from "./locales/en/orderEdit.json";
import arOrderEdit from "./locales/ar/orderEdit.json";

function keyTree(value: unknown, prefix = ""): string[] {
    if (typeof value !== "object" || value === null) return [prefix];
    return Object.entries(value).flatMap(([key, child]) => keyTree(child, prefix ? `${prefix}.${key}` : key));
}

function leaves(value: unknown): unknown[] {
    if (typeof value !== "object" || value === null) return [value];
    return Object.values(value).flatMap(leaves);
}

describe("i18n orderEdit namespace registration", () => {
    it("registers the orderEdit namespace in the English resource bundle", () => {
        expect(resources.en.orderEdit).toEqual(enOrderEdit);
    });

    it("registers the orderEdit namespace in the Arabic resource bundle", () => {
        expect(resources.ar.orderEdit).toEqual(arOrderEdit);
    });

    it("includes orderEdit in the list of namespaces i18next loads", () => {
        expect(i18n.options.ns).toContain("orderEdit");
    });

    it("keeps identical key trees in English and Arabic", () => {
        expect(keyTree(arOrderEdit).sort()).toEqual(keyTree(enOrderEdit).sort());
    });

    it("leaves no Arabic string empty", () => {
        expect(leaves(arOrderEdit).filter(text => text === "")).toEqual([]);
    });
});
