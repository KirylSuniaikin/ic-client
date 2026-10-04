// Mirrors the backend's duplicate-name rule for products (POST /api/products answers 409 on a
// match), so the create form and the purchase dropdown can tell a duplicate apart BEFORE the round
// trip. The server stays the authority: this only makes the common case instant.

/** The form a product name is stored in: trimmed, internal whitespace collapsed to single spaces. */
export function cleanProductName(name: string): string {
    return name.trim().replace(/\s+/g, " ");
}

/** The comparison key: the cleaned name, case-insensitive. Two names with equal keys are duplicates. */
export function normalizeProductName(name: string): string {
    return cleanProductName(name).toLowerCase();
}

// POST /api/vendors applies the very same rule to vendor names, so vendors share the
// implementation rather than keep a copy that could drift from it.

/** The form a vendor name is stored in. Same rule as {@link cleanProductName}. */
export function cleanVendorName(name: string): string {
    return cleanProductName(name);
}

/** The vendor duplicate key. Same rule as {@link normalizeProductName}. */
export function normalizeVendorName(name: string): string {
    return normalizeProductName(name);
}
