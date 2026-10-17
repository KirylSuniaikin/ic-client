import { describe, it, expect } from "@jest/globals";
import { labelOf } from "./labelOf";

const LABELS: Record<"A" | "B", string> = { A: "Alpha", B: "Beta" };

describe("labelOf", () => {
    it("returns the label of a known value", () => {
        expect(labelOf(LABELS, "B")).toBe("Beta");
    });

    /** A value a newer server added must still print, as itself. */
    it("returns the raw value for one it does not know", () => {
        expect(labelOf(LABELS, "C")).toBe("C");
    });

    it("does not mistake an inherited property for a label", () => {
        expect(labelOf(LABELS, "toString")).toBe("toString");
    });
});
