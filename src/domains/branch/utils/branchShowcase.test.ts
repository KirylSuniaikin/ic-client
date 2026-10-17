import { describe, it, expect } from "@jest/globals";
import { existsSync } from "fs";
import { join } from "path";
import { BRANCH_SHOWCASE, getBranchShowcase } from "./branchShowcase";
import type { ShowcaseText } from "./branchShowcase";

const PUBLIC_DIR = join(__dirname, "..", "..", "..", "..", "public");

function isFilled(text: ShowcaseText): boolean {
    return text.en.trim().length > 0 && text.ar.trim().length > 0;
}

describe("getBranchShowcase", () => {
    it("returns null for a branch with no entry", () => {
        expect(getBranchShowcase({ branchNo: -1 }, "en")).toBeNull();
    });
});

// Passes trivially while the config is empty; it is here for the owner's future edits, so a typo
// in a path or a missing translation fails the suite instead of shipping a broken card.
describe("BRANCH_SHOWCASE config", () => {
    const entries = Object.entries(BRANCH_SHOWCASE);

    it("gives every entry at least one photo or a how-to-find-us note", () => {
        for (const [, entry] of entries) {
            expect(entry.photos.length > 0 || entry.findUs !== undefined).toBe(true);
        }
    });

    it("keeps every photo in its own branch's folder, and the file exists", () => {
        for (const [branchNo, entry] of entries) {
            for (const photo of entry.photos) {
                expect(photo.src.startsWith(`/branchImages/${branchNo}/`)).toBe(true);
                expect(existsSync(join(PUBLIC_DIR, photo.src))).toBe(true);
            }
        }
    });

    it("fills in both English and Arabic for every note and alt text", () => {
        const texts: ShowcaseText[] = entries.flatMap(([, entry]) => [
            ...(entry.findUs === undefined ? [] : [entry.findUs]),
            ...entry.photos.flatMap((photo) => (photo.alt === undefined ? [] : [photo.alt])),
        ]);

        for (const text of texts) {
            expect(isFilled(text)).toBe(true);
        }
    });
});
