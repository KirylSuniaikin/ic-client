// Pins the staff-only `statistics` namespace (admin statistics dashboard): both locale bundles and the
// `ns` list. A namespace missing from `ns` silently 404s every lookup at runtime.
import { describe, it, expect } from "@jest/globals";
import i18n, { resources } from "./index";
import enStatistics from "./locales/en/statistics.json";
import arStatistics from "./locales/ar/statistics.json";

function keyTree(value: unknown, prefix = ""): string[] {
    if (typeof value !== "object" || value === null) return [prefix];
    return Object.entries(value).flatMap(([key, child]) => keyTree(child, prefix ? `${prefix}.${key}` : key));
}

function leaves(value: unknown): unknown[] {
    if (typeof value !== "object" || value === null) return [value];
    return Object.values(value).flatMap(leaves);
}

describe("i18n statistics namespace registration", () => {
    it("registers the statistics namespace in the English resource bundle", () => {
        expect(resources.en.statistics).toEqual(enStatistics);
    });

    it("registers the statistics namespace in the Arabic resource bundle", () => {
        expect(resources.ar.statistics).toEqual(arStatistics);
    });

    it("includes statistics in the list of namespaces i18next loads", () => {
        expect(i18n.options.ns).toContain("statistics");
    });

    it("keeps identical key trees in English and Arabic", () => {
        expect(keyTree(arStatistics).sort()).toEqual(keyTree(enStatistics).sort());
    });

    it("leaves no Arabic string empty", () => {
        expect(leaves(arStatistics).filter(text => text === "")).toEqual([]);
    });
});
