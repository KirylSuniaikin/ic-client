// Assumed: the spec's "immediately followed by end-of-match or whitespace" collapses to plain
// end-of-match, since the \S+ capture already stops at the first whitespace character.
const URL_RE = /https?:\/\/\S+/g;
const TRAILING_PUNCTUATION_RE = /[.,)\]]+$/;

// Generic text utility (not task-board-specific): pulls out http(s) URLs from free text, strips
// punctuation that's almost certainly trailing prose rather than part of the URL, de-duplicates,
// and preserves first-seen order.
export function extractUrls(text: string): string[] {
    const matches = text.match(URL_RE) ?? [];
    const seen = new Set<string>();
    const result: string[] = [];

    for (const match of matches) {
        const url = match.replace(TRAILING_PUNCTUATION_RE, "");
        if (url.length === 0 || seen.has(url)) continue;
        seen.add(url);
        result.push(url);
    }

    return result;
}
