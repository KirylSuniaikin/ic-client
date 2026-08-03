// Shared by the prep-plan table (component units) and the inventory report table
// (product units); both mirror backend com.icpizza.backend.domain.prepplan.Unit.
export type MeasureUnit = "GRAMS" | "PIECES" | "ML";

// Nullable input: Product.unit is a nullable column being backfilled by hand, so a
// product with no unit yet renders an em dash rather than an empty cell. Unknown
// non-null strings pass through unchanged (existing prep-plan behaviour).
export function formatUnit(unit: MeasureUnit | string | null | undefined): string {
    if (unit === "GRAMS") return "g";
    if (unit === "PIECES") return "pcs";
    if (unit === "ML") return "ml";
    return unit ?? "—";
}
