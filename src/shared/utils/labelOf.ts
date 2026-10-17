function hasLabel<K extends string>(labels: Record<K, string>, key: string): key is K {
    return Object.prototype.hasOwnProperty.call(labels, key);
}

/**
 * The label for an enum value from the server, or the raw value when this build does not know it
 * yet. A newer backend can add a value before the client ships; it should print as itself rather
 * than as a blank or a crash.
 */
export function labelOf<K extends string>(labels: Record<K, string>, key: string): string {
    return hasLabel(labels, key) ? labels[key] : key;
}
