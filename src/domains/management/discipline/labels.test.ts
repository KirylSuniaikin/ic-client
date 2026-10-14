import { describe, it, expect } from "@jest/globals";
import { ACTION_LEVEL_LABEL, violationClassLabel } from "./labels";
import { formatDate, formatDateTime, formatHours } from "./format";

describe("labels", () => {
    it("maps every action level", () => {
        expect(ACTION_LEVEL_LABEL.WRITTEN).toBe("Written Warning");
        expect(ACTION_LEVEL_LABEL.FINAL).toBe("Final Written Warning");
        expect(ACTION_LEVEL_LABEL.TERMINATION).toBe("Termination");
        expect(ACTION_LEVEL_LABEL.TERMINATION_ART107).toBe("Termination (art.107) record");
    });

    it("formats a class label", () => {
        expect(violationClassLabel("B")).toBe("Class B");
        expect(violationClassLabel("D")).toBe("Class D");
    });
});

describe("format", () => {
    it("formats a date-only ISO string", () => {
        expect(formatDate("2026-10-07")).toBe("7 Oct 2026");
    });

    it("formats a date from a full timestamp, dropping the time", () => {
        expect(formatDate("2026-10-07T10:15:00")).toBe("7 Oct 2026");
    });

    it("formats a date-time without shifting it into the browser zone", () => {
        expect(formatDateTime("2026-10-07T10:15:00")).toBe("7 Oct 2026, 10:15");
        expect(formatDateTime("2026-01-01T00:05:00")).toBe("1 Jan 2026, 00:05");
    });

    it("formats a date-time with no time part as a date", () => {
        expect(formatDateTime("2026-10-07")).toBe("7 Oct 2026");
    });

    it("returns unparseable input unchanged", () => {
        expect(formatDate("garbage")).toBe("garbage");
    });

    it("formats hours with two decimals", () => {
        expect(formatHours(1)).toBe("1.00");
        expect(formatHours(2.5)).toBe("2.50");
    });
});
