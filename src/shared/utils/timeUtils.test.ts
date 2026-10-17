import { describe, it, expect } from "@jest/globals";
import { formatBahrainClock, formatBahrainDateTime } from "./timeUtils";

describe("formatBahrainDateTime", () => {
    /** The server sends zoneless Bahrain wall time; it must come back out unchanged, in any device zone. */
    it("renders a zoneless Bahrain timestamp as day, month, year and wall-clock time", () => {
        expect(formatBahrainDateTime("2026-10-06T15:00:00")).toBe("6 Oct 2026, 15:00");
    });

    it("keeps the wall-clock time of a timestamp with fractional seconds", () => {
        expect(formatBahrainDateTime("2026-10-06T19:02:11.123456")).toBe("6 Oct 2026, 19:02");
    });

    it("returns null when there is nothing to show", () => {
        expect(formatBahrainDateTime(null)).toBeNull();
        expect(formatBahrainDateTime("")).toBeNull();
    });

    it("agrees with formatBahrainClock on the time of day", () => {
        expect(formatBahrainDateTime("2026-10-06T23:45:00")).toContain(formatBahrainClock("2026-10-06T23:45:00") ?? "");
    });
});
