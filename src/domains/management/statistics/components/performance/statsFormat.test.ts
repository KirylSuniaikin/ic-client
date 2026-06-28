import { describe, it, expect } from "@jest/globals";
import { formatPrepTime } from "./statsFormat";

describe("formatPrepTime", () => {
    it("renders minutes and seconds for durations of a minute or more", () => {
        const result = formatPrepTime(750);

        expect(result).toBe("12m 30s");
    });

    it("renders seconds only when under a minute", () => {
        const result = formatPrepTime(45);

        expect(result).toBe("45s");
    });

    it("rounds fractional seconds to the nearest whole second", () => {
        const result = formatPrepTime(89.6);

        expect(result).toBe("1m 30s");
    });

    it("returns an em dash when no prep time has been recorded", () => {
        const result = formatPrepTime(null);

        expect(result).toBe("—");
    });
});
