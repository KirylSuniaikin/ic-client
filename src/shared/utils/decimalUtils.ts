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
