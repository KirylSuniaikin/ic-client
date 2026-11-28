// Shared by the prep-plan table (component units) and the inventory report table
// (product units); both mirror backend com.icpizza.backend.domain.prepplan.Unit.
export type MeasureUnit = "GRAMS" | "PIECES" | "ML";

// Every unit, in the order a unit picker offers them.
export const MEASURE_UNITS = ["GRAMS", "PIECES", "ML"] as const satisfies readonly MeasureUnit[];

// Nullable input: Product.unit is a nullable column being backfilled by hand, so a
// product with no unit yet renders an em dash rather than an empty cell. Unknown
// non-null strings pass through unchanged (existing prep-plan behaviour).
export function formatUnit(unit: MeasureUnit | string | null | undefined): string {
    if (unit === "GRAMS") return "g";
    if (unit === "PIECES") return "pcs";
    if (unit === "ML") return "ml";
    return unit ?? "—";
}

// Stock is counted, bought and priced per kilogram / litre / piece (products.price is per kg), while
// recipes and the prep plan measure the same GRAMS/ML products in grams / millilitres. The inventory
// count therefore shows the stock unit: a "g" beside a kilogram count reads 8.6 kg as 8.6 g.
export function formatStockUnit(unit: MeasureUnit | string | null | undefined): string {
    if (unit === "GRAMS") return "kg";
    if (unit === "ML") return "L";
    return formatUnit(unit);
}

// "/ kg", "/ L", "/ pcs" after a price per stock unit; empty when the product has no unit yet, so a
// legacy row shows the bare number rather than a guessed unit.
export function perStockUnit(unit: MeasureUnit | string | null | undefined): string {
    return unit ? `/ ${formatStockUnit(unit)}` : "";
}
