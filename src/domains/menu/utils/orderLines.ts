import type { Customization } from "../types";
import {
    parseExtrasNames,
    parseRemovalNames,
    splitNote,
    stripExtrasParts,
    stripRemovalTokens,
} from "./customizations";

/**
 * Kitchen-ticket row builder - shared by the printer (BluetoothPrinterService) and the admin
 * OrderCard. English-only, catalog-free (customization name is server-stamped), pure. The
 * localized customer-facing path is buildDisplay.ts; this file is deliberately separate and
 * must not be merged with it.
 */
export type TicketSource = {
    description?: string;
    isThinDough?: boolean;
    isGarlicCrust?: boolean;
    customizations?: Customization[];
    // Read only to de-duplicate the loose-description tier against the note resolveKitchenNote
    // already renders on its own row.
    note?: string;
    noteTranslated?: string;
};

// Mirrors the literal copy buildDisplay.ts falls back to (buildDisplay.ts:87-88) - that file
// resolves these against a menu-driven doughLabels map instead of exporting a constant, so the
// identical English text is redefined here rather than imported.
const THIN_DOUGH_LABEL = "Thin Dough";
const GARLIC_CRUST_LABEL = "Garlic Crust";

// Mirrors TOPPING_SUFFIX in buildDisplay.ts:38.
const TOPPING_SUFFIX = " Topping";

// Loose-description spellings of a choice the isGarlicCrust/isThinDough flags already emitted a
// row for. Applied ONLY in the loose tier below, never to the grammar parsers: an extra genuinely
// named "Garlic" is a real catalog row, and dropping it out of a parsed `+(...)` group would lose
// a paid ingredient. In the loose tier these are the literals aggregator feeds append next to the
// flag they also set, so filtering them is what prevents a duplicate row.
const GARLIC_CRUST_TOKENS = new Set(["garlic", "garlic crust", "with garlic oil on the crust"]);
const THIN_DOUGH_TOKENS = new Set(["thin", "thin dough"]);

/**
 * Last-resort tier: a description that matched no token grammar at all. That is every Keeta
 * order (the scraper sends a bare `"Cheddar x1, Darblu Cheese x1"` comma list) and every
 * pre-grammar order still in the DB. Rendering the text verbatim is the only way those modifiers
 * reach the kitchen; the alternative is the silent drop this tier exists to fix.
 */
function looseDescriptionLines(source: TicketSource, description: string): string[] {
    // resolveKitchenNote renders the free-text note on its own row, so cut that span off first
    // or a description like "+(x) +extra crispy" prints the note twice.
    const withoutNote = description.slice(0, splitNote(description).noteStartIndex);
    const body = stripExtrasParts(stripRemovalTokens(withoutNote));
    const note = (source.noteTranslated ?? source.note ?? "").trim().toLowerCase();

    return body
        .split(",")
        .map(token => token.trim().replace(/^\+\s*/, "").replace(/\s+x1$/i, "").trim())
        .filter(token => {
            if (!token) return false;
            const lower = token.toLowerCase();
            if (source.isGarlicCrust && GARLIC_CRUST_TOKENS.has(lower)) return false;
            if (source.isThinDough && THIN_DOUGH_TOKENS.has(lower)) return false;
            return lower !== note;
        })
        .map(token => `+ ${token}`);
}

/** Builds one ticket row per modifier, in array order: dough/crust flags first, then the first
 * tier that yields anything - structured customizations rows, else the legacy-description
 * grammar parsers, else the raw description split on commas. */
export function buildTicketLines(source: TicketSource): string[] {
    const lines: string[] = [];

    if (source.isThinDough) lines.push(`+ ${THIN_DOUGH_LABEL}`);
    if (source.isGarlicCrust) lines.push(`+ ${GARLIC_CRUST_LABEL}`);

    const customizations = source.customizations ?? [];
    if (customizations.length > 0) {
        for (const customization of customizations) {
            const name = customization.name ?? "";
            if (customization.action === "ADD" && customization.toppingId != null) {
                lines.push(`+ ${name}${TOPPING_SUFFIX}`);
            } else if (customization.action === "ADD" && customization.extraIngrId != null) {
                lines.push(`+ ${name}`);
            } else if (customization.action === "REMOVE") {
                lines.push(`- NO ${name}`);
            }
        }
        return lines;
    }

    // Legacy fallback (pre-migration orders and aggregator orders without structured
    // customizations) - reuse the existing description parsers rather than hand-rolling a new
    // one. Dough is never derived from the description here; the flags above already cover it.
    const description = source.description ?? "";
    const beforeDescription = lines.length;

    for (const name of parseExtrasNames(description)) {
        // When the isGarlicCrust flag is set it already emitted this row above, and the customer
        // flow also folds "garlic crust" into the description additions group - skip the duplicate.
        // Only skip when the flag covered it, so legacy orders that encode crust solely in the
        // description (no flag) still render the line.
        if (source.isGarlicCrust && name.trim().toLowerCase() === "garlic crust") continue;
        lines.push(`+ ${name}`);
    }
    for (const name of parseRemovalNames(description)) {
        lines.push(`- NO ${name}`);
    }

    if (lines.length === beforeDescription) {
        lines.push(...looseDescriptionLines(source, description));
    }

    return lines;
}

/** Resolves the kitchen-facing note: translated note first (DeepL, English), then the raw note,
 * then the legacy free-text note parsed out of description for orders that predate the note
 * column. Empty string when none apply. */
export function resolveKitchenNote(source: { note?: string; noteTranslated?: string; description?: string }): string {
    if (source.noteTranslated && source.noteTranslated.trim() !== "") return source.noteTranslated;
    if (source.note && source.note.trim() !== "") return source.note;
    return splitNote(source.description ?? "").noteText;
}
