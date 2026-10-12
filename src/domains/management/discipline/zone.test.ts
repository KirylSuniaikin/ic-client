import { describe, it, expect } from "@jest/globals";
import { ZONE_STYLE } from "./zone";

describe("ZONE_STYLE", () => {
    it("labels the four zones", () => {
        expect(ZONE_STYLE.GREEN.label).toBe("Green zone");
        expect(ZONE_STYLE.YELLOW.label).toBe("Yellow zone");
        expect(ZONE_STYLE.ORANGE.label).toBe("Orange zone");
        expect(ZONE_STYLE.RED.label).toBe("Red zone");
    });

    it("gives every zone a distinct background and a foreground", () => {
        const bgs = new Set(Object.values(ZONE_STYLE).map((z) => z.bg));
        expect(bgs.size).toBe(4);
        Object.values(ZONE_STYLE).forEach((z) => expect(z.fg).toBeTruthy());
    });
});
