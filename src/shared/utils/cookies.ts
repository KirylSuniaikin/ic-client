// Reads a single cookie value from document.cookie. Returns undefined when the
// cookie is missing or empty (an empty cookie is treated the same as absent by
// callers, which only care about a non-blank value).
export function getCookie(name: string): string | undefined {
    const prefix = `${name}=`;
    const match = document.cookie
        .split(';')
        .map(part => part.trim())
        .find(part => part.startsWith(prefix));

    if (!match) return undefined;

    const value = match.substring(prefix.length);
    return value ? decodeURIComponent(value) : undefined;
}
