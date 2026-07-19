import type { Customization, RecipeComponent } from "../types";

/**
 * Single home for the description-token grammar shared by additions (extras + drizzles)
 * and removals.
 *
 * Unified grammar (sign OUTSIDE the paren, comma-separated inside a single group):
 * - Additions: `+(Mushroom, Olives, Garlic Topping)` — extras and drizzles share one group;
 *   drizzle names keep their " Topping" marker.
 * - Removals: `-(Marinara, Onion)`.
 * Dough (`+Thin`) and the free-text note (`+<note>`) are NOT "ingredients" and are not part
 * of either group.
 *
 * Placement rule: additions group(s) first, then the removals group, then dough (if
 * applicable), then the free-text note LAST — so `parseItemNote`'s "text after the last `)`"
 * heuristic keeps finding the note.
 *
 * Backward compatibility: historical orders and pre-deploy carts carry the OLD grammar
 * (`(+X +Y)` for additions, per-item `-(X)` for removals). The parsers below accept BOTH the
 * new grouped format and the old format so edit-mode rehydration never breaks on old strings.
 */

const REMOVAL_TOKEN_RE = /\s*-\(([^)]*)\)/g;

export type RemovedComponent = { id: number; name: string };

/** `[{name: "Marinara"}, {name: "Onion"}]` -> `"-(Marinara, Onion)"` */
export function buildRemovalTokens(removed: RemovedComponent[]): string {
    return removed.length ? `-(${removed.map(component => component.name).join(", ")})` : "";
}

/** `["Mushroom", "Olives"]` -> `"+(Mushroom, Olives)"` — single group for extras + drizzles. */
export function buildAdditionTokens(names: string[]): string {
    return names.length ? `+(${names.join(", ")})` : "";
}

/** Strips every `-(x)` / `-(x, y)` token; used before parsing extras/notes out of a description. */
export function stripRemovalTokens(description: string): string {
    return description.replace(REMOVAL_TOKEN_RE, "").trim();
}

export type NoteSplit = {
    // Index into the ORIGINAL (unstripped) `description` where the free-text note span begins;
    // equals `description.length` when there is no note (nothing to preserve/strip out).
    noteStartIndex: number;
    // Parsed, trimmed note text — concatenation of every `+`-prefixed run found after the last
    // structural `)`, excluding the dough token "Thin". Same value `parseItemNote` (useMenuData.ts)
    // has always returned; kept here so callers that only need the text don't recompute it.
    noteText: string;
};

/**
 * Single source of truth for locating the customer's free-text note within a generated
 * description string (see the grammar placement rule above: additions, then removals, then
 * dough, then the note LAST). Its only consumer now is `parseItemNote` (useMenuData.ts,
 * edit-mode rehydration for pre-migration orders that lack a structured `note` field).
 *
 * Heuristic: strip `-(...)` removal tokens (they're structural, not note text, and their parens
 * would otherwise confuse "the last `)`"), then — if what's left still has parentheses — take the
 * substring after the LAST `)`; the first `+`-prefixed run there that isn't the dough token "Thin"
 * marks where the note begins. Because removals always sit before dough/note in the placement
 * rule, that tail is a literal, unshifted suffix of the original `description` too, so its start
 * index can be mapped back by suffix length instead of re-deriving offsets against stripped
 * positions.
 *
 * Known inherited limitation (shared with `parseItemNote`, not something to fix here): a note
 * that itself contains a `)` truncates under the "text after the last `)`" heuristic.
 */
export function splitNote(description: string): NoteSplit {
    const stripped = stripRemovalTokens(description);
    const hasParentheses = /\(.*?\)/.test(stripped);
    const restPartStart = hasParentheses ? stripped.lastIndexOf(")") + 1 : 0;
    const restPart = stripped.substring(restPartStart);

    const plusRegex = /\+([^+]+)/g;
    let noteText = "";
    let noteStartInRestPart = -1;
    let match: RegExpExecArray | null;
    while ((match = plusRegex.exec(restPart)) !== null) {
        const text = match[1].trim();
        if (text === "Thin") continue;
        if (noteStartInRestPart === -1) noteStartInRestPart = match.index;
        noteText += (noteText ? " " : "") + text;
    }

    if (noteStartInRestPart === -1) {
        return { noteStartIndex: description.length, noteText: "" };
    }

    const noteStartInStripped = restPartStart + noteStartInRestPart;
    const noteStartIndex = description.length - (stripped.length - noteStartInStripped);

    return { noteStartIndex, noteText: noteText.trim() };
}

/**
 * Fallback hydration for orders without structural data: `-(x, y)` (new, grouped) and
 * legacy per-item `-(x)` `-(y)` tokens -> component names.
 */
export function parseRemovalNames(description: string): string[] {
    // Fresh regex per call: exec loops mutate lastIndex on /g regexes.
    const re = /-\(([^)]*)\)/g;
    const names: string[] = [];
    let match = re.exec(description);
    while (match !== null) {
        names.push(...match[1].split(",").map(s => s.trim()).filter(Boolean));
        match = re.exec(description);
    }
    return names;
}

/** Extracts the removed components (id + display name) from structural customizations. */
export function removedFromCustomizations(customizations?: Customization[]): RemovedComponent[] {
    return (customizations ?? [])
        .filter(c => c.action === "REMOVE" && c.componentId != null)
        .map(c => ({ id: c.componentId as number, name: c.name ?? "" }));
}

/** Extracts added extra-ingredient names from structural customizations (names are catalog-stamped). */
export function extrasFromCustomizations(customizations?: Customization[]): string[] {
    return (customizations ?? [])
        .filter(c => c.action === "ADD" && c.extraIngrId != null && !!c.name)
        .map(c => c.name as string);
}

/**
 * Parses added-ingredient names (extras + drizzles) out of the generated description groups.
 * Accepts BOTH the new grouped `+(a, b)` format (sign outside the paren, comma-separated) and
 * the legacy `(+X +Y)` format (sign inside, space-separated) for old orders/carts. Fallback
 * hydration for legacy lines without structural customizations.
 */
export function parseExtrasNames(description: string): string[] {
    const names: string[] = [];

    const newRe = /\+\(([^)]*)\)/g;
    let match = newRe.exec(description);
    while (match !== null) {
        names.push(...match[1].split(",").map(s => s.trim()).filter(Boolean));
        match = newRe.exec(description);
    }

    const legacyRe = /\(\s*\+([^)]*)\)/g;
    match = legacyRe.exec(description);
    while (match !== null) {
        names.push(...match[1].split("+").map(s => s.trim()).filter(Boolean));
        match = legacyRe.exec(description);
    }

    return names;
}

/** Strips both the new `+(a, b)` and legacy `(+X +Y)` addition groups (customer parens not matching either shape survive). */
export function stripExtrasParts(description: string): string {
    return description
        .replace(/\s*\+\([^)]*\)/g, "")
        .replace(/\s*\(\s*\+[^)]*\)/g, "")
        .replace(/\s*,\s*,/g, ",")
        .replace(/^[,\s]+/, "")
        .replace(/[,\s]+$/, "");
}

/** Builds the REMOVE entries of a CartItem's customizations from popup removal state. */
export function toRemoveCustomizations(removed: RemovedComponent[]): Customization[] {
    return removed.map(component => ({
        action: "REMOVE" as const,
        componentId: component.id,
        quantity: 1,
        name: component.name,
    }));
}

/** Order-insensitive equality of the REMOVE sets — cart merge must not fold different removals. */
export function sameRemovals(a?: Customization[], b?: Customization[]): boolean {
    const idsA = removedFromCustomizations(a).map(r => r.id).sort();
    const idsB = removedFromCustomizations(b).map(r => r.id).sort();
    return idsA.length === idsB.length && idsA.every((id, i) => id === idsB[i]);
}

/**
 * Re-resolves removal state against a (possibly different) size's recipe: keeps removals whose
 * component id still exists, drops the rest. Used on size toggle instead of a hard reset.
 */
export function intersectRemovals(
    removed: RemovedComponent[],
    components: RecipeComponent[]
): RemovedComponent[] {
    const validIds = new Set(components.map(c => c.id));
    return removed.filter(r => validIds.has(r.id));
}

/** Matches legacy `-(x)` names against a recipe to rebuild {id, name} removal state. */
export function matchRemovalNames(
    names: string[],
    components: RecipeComponent[]
): RemovedComponent[] {
    const byName = new Map(components.map(c => [c.name.toLowerCase(), c] as const));
    const matched: RemovedComponent[] = [];
    for (const name of names) {
        const component = byName.get(name.toLowerCase());
        if (component) matched.push({ id: component.id, name: component.name });
    }
    return matched;
}
