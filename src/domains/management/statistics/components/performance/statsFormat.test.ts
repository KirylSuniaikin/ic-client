import { describe, it, expect, afterEach } from "@jest/globals";
import { formatPrepTime, formatStatRange } from "./statsFormat";

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

describe("formatStatRange", () => {
    const originalTz = process.env.TZ;

    afterEach(() => {
        process.env.TZ = originalTz;
    });

    it("renders a single date when the start and finish are the same calendar day", () => {
        const result = formatStatRange("2026-07-10", "2026-07-10");

        expect(result).toBe("Jul 10, 2026");
    });

    it("renders a start — finish range when the dates differ", () => {
        const result = formatStatRange("2026-07-04", "2026-07-10");

        expect(result).toBe("Jul 4, 2026 — Jul 10, 2026");
    });

    it("does not UTC-shift the date in a negative-offset browser timezone", () => {
        process.env.TZ = "America/Los_Angeles";

        const result = formatStatRange("2026-07-10", "2026-07-10");

        expect(result).toBe("Jul 10, 2026");
    });
});

