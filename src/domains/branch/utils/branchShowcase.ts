import type { IBranch } from "../../management/inventory/types";

/**
 * Per-branch photos and the "How to find us" note for the branch details sheet.
 *
 * No stock or placeholder photos: a branch without an entry shows the
 * finished no-photo layout (the storefront roundel).
 *
 * To add a branch:
 *  1. Find its number: `SELECT branch_number, branch_name FROM branches;` on prod. This is the
 *     `branchNo` the API sends. It is the same on every environment; the UUID `id` is not.
 *  2. Export 3–5 photos as WebP, 4:5 portrait, 640×800, quality ~75, at most ~60 KB each. The first
 *     one is the cover: it also becomes the branch's thumbnail in the branch list. One photo alone
 *     is shown as a single wide 16:9 card, cropped from the centre.
 *  3. Save them as public/branchImages/<branchNo>/01-storefront.webp, 02-counter.webp, …
 *  4. Add an entry below. `findUs` is optional; when present it needs BOTH en and ar.
 *  5. Run `CI=true yarn test --watchAll=false src/domains/branch`. The config test fails on a
 *     missing file, a wrong folder or an empty translation.
 */
export interface ShowcaseText {
    en: string;
    ar: string;
}

export interface BranchShowcasePhoto {
    /** Root-absolute path under public/: "/branchImages/<branchNo>/<file>.webp". */
    src: string;
    /** Optional description for screen readers; defaults to "<branch name>, photo <n>". */
    alt?: ShowcaseText;
}

export interface BranchShowcase {
    photos: readonly BranchShowcasePhoto[];
    findUs?: ShowcaseText;
}

/** Keyed by branchNo (branches.branch_number). */
export const BRANCH_SHOWCASE: Readonly<Record<number, BranchShowcase>> = {
    // Al-Hidd
    1: {
        photos: [
            { src: "/branchImages/1/01-storefront.webp" },
            { src: "/branchImages/1/02-counter.webp" },
            { src: "/branchImages/1/03-kitchen.webp" },
            { src: "/branchImages/1/04-pizza.webp" },
            { src: "/branchImages/1/05-team.webp" },
        ],
    },
};

/** The entry, already in the reader's language. */
export interface BranchShowcaseView {
    photos: readonly { src: string; alt: string | null }[];
    findUs: string | null;
}

/** Matched by prefix, the way branchDisplayName matches it, so `ar-BH` counts as Arabic. */
function pick(text: ShowcaseText, language: string): string {
    return language.startsWith("ar") ? text.ar : text.en;
}

export function getBranchShowcase(branch: Pick<IBranch, "branchNo">, language: string): BranchShowcaseView | null {
    const entry = BRANCH_SHOWCASE[branch.branchNo];
    if (entry === undefined) return null;

    return {
        photos: entry.photos.map((photo) => ({
            src: photo.src,
            alt: photo.alt === undefined ? null : pick(photo.alt, language),
        })),
        findUs: entry.findUs === undefined ? null : pick(entry.findUs, language),
    };
}
