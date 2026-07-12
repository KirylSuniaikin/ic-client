import Decimal from "decimal.js-light";

export function toDecimal(v: unknown): Decimal {
    if (v instanceof Decimal) return v;
    if (v === null || v === undefined) return new Decimal(0);
    if (typeof v === "number") return Number.isFinite(v) ? new Decimal(v) : new Decimal(0);
    if (typeof v === "string") {
        const s = v.trim().replace(",", ".");
        if (s === "" || s === "-" || s === "." || s === "-.") return new Decimal(0);
        if (!/^-?\d+(\.\d+)?$/.test(s)) return new Decimal(0);
        return new Decimal(s);
    }
    return new Decimal(0);
}

export const q3 = (x: Decimal): Decimal => x.toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
export const p2 = (x: Decimal): Decimal => x.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

// Null-preserving counterpart to toDecimal — returns null for null/undefined input
// instead of Decimal(0). toDecimal itself is untouched (other callers depend on its
// current null->0 behavior).
export function toDecimalOrNull(v: unknown): Decimal | null {
    if (v === null || v === undefined) return null;
    return toDecimal(v);
}

// Single null-aware formatter — returns "" for null so the input renders its
// `placeholder` prop instead of a "0.000" value.
export function fmt3(value: Decimal | number | null | undefined): string {
    if (value === null || value === undefined) return "";
    const d = toDecimal(value);
    return Number.isFinite(d.toNumber()) ? d.toFixed(3) : "";
}

// Moved verbatim from purchases/components/DecimalCellEditor.tsx.
export function normalizeDecimal(s: unknown): string {
    let t = String(s ?? "").trim().replace(",", ".");
    t = t.replace(/[^\d.-]/g, "");
    t = t.replace(/(?!^)-/g, "");
    const i = t.indexOf(".");
    if (i !== -1) t = t.slice(0, i + 1) + t.slice(i + 1).replace(/\./g, "");
    return t;
}
