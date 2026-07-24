import type { Customization } from "../types";
import { parseExtrasNames, parseRemovalNames, splitNote } from "./customizations";

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
};

// Mirrors the literal copy buildDisplay.ts falls back to (buildDisplay.ts:87-88) - that file
// resolves these against a menu-driven doughLabels map instead of exporting a constant, so the
// identical English text is redefined here rather than imported.
const THIN_DOUGH_LABEL = "Thin Dough";
const GARLIC_CRUST_LABEL = "Garlic Crust";

// Mirrors TOPPING_SUFFIX in buildDisplay.ts:38.
const TOPPING_SUFFIX = " Topping";

/** Builds one ticket row per modifier, in array order: dough/crust flags first, then either the
 * structured customizations rows or (when absent/empty) a legacy-description fallback. */
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
