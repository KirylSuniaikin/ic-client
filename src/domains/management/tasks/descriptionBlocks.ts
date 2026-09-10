// Not reachable from keyboard/IME — a user's own text (incl. the word "goal" or a colon) can
// never collide with it.
export const DESCRIPTION_BLOCK_DELIMITER = "␞";

export type TaskDescriptionBlocks = {
    goal: string;
    doneCriteria: string;
    progressComments: string;
    blocker: string;
};
export type ParsedTaskDescription = TaskDescriptionBlocks & { isLegacy: boolean };

const BLOCK_KEYS: (keyof TaskDescriptionBlocks)[] = ["goal", "doneCriteria", "progressComments", "blocker"];

// Trim each block; if all four trim to "" return "" (not three bare delimiters) — this preserves
// the existing `description.length > 0 ? description : null` null-out convention used downstream.
export function composeTaskDescription(blocks: TaskDescriptionBlocks): string {
    const trimmed = BLOCK_KEYS.map(key => blocks[key].trim());

    if (trimmed.every(value => value.length === 0)) {
        return "";
    }

    return trimmed.join(DESCRIPTION_BLOCK_DELIMITER);
}

// Positional format: goal + DELIMITER + doneCriteria + DELIMITER + progressComments + DELIMITER +
// blocker. Parsing is plain string splitting, not regex/keyword matching. 0 delimiters => legacy
// (entire raw string becomes goal). Fewer than 3 delimiters (malformed input) degrades gracefully,
// filling blocks positionally and leaving the rest empty. More than 3 delimiters folds any extra
// trailing delimiter chars back into blocker rather than dropping them.
export function parseTaskDescription(raw: string | null): ParsedTaskDescription {
    if (raw === null) {
        return { goal: "", doneCriteria: "", progressComments: "", blocker: "", isLegacy: false };
    }

    const parts = raw.split(DESCRIPTION_BLOCK_DELIMITER);
    if (parts.length === 1) {
        return { goal: raw, doneCriteria: "", progressComments: "", blocker: "", isLegacy: true };
    }

    return {
        goal: parts[0],
        doneCriteria: parts[1] ?? "",
        progressComments: parts[2] ?? "",
        blocker: parts.slice(3).join(DESCRIPTION_BLOCK_DELIMITER),
        isLegacy: false,
    };
}

export function hasDescriptionContent(raw: string | null): boolean {
    return raw !== null && raw.trim().length > 0;
}
