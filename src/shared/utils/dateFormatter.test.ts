import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { dateFormatter } from "./dateFormatter";

describe("dateFormatter", () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe("format structure", () => {
        it("returns a string", () => {
            jest.setSystemTime(new Date("2025-06-15"));

            expect(typeof dateFormatter()).toBe("string");
        });

        it("uses '-' as the default separator", () => {
            jest.setSystemTime(new Date("2025-06-15"));

            expect(dateFormatter()).toContain("-");
        });

        it("uses a custom separator when provided", () => {
            jest.setSystemTime(new Date("2025-06-15"));

            expect(dateFormatter("/")).toContain("/");
        });

        it("uses space separator when provided", () => {
            jest.setSystemTime(new Date("2025-06-15"));

            expect(dateFormatter(" ")).toContain(" ");
        });

        it("ends with a two-digit year", () => {
            jest.setSystemTime(new Date("2025-06-15"));

            expect(dateFormatter()).toMatch(/\d{2}$/);
        });
    });

    describe("month — mid-month (day > 3)", () => {
        it("returns the current month name when day is 15", () => {
            jest.setSystemTime(new Date("2025-06-15"));

            const result = dateFormatter("-", "en");

            expect(result.toLowerCase()).toMatch(/jun/);
        });

        it("returns the current month name when day is 4", () => {
            jest.setSystemTime(new Date("2025-06-04"));

            const result = dateFormatter("-", "en");

            expect(result.toLowerCase()).toMatch(/jun/);
        });
    });

    describe("month rollback when day <= 3", () => {
        it("returns the previous month name when day is 1", () => {
            jest.setSystemTime(new Date("2025-06-01"));

            const result = dateFormatter("-", "en");

            expect(result.toLowerCase()).toMatch(/may/);
        });

        it("returns the previous month name when day is 2", () => {
            jest.setSystemTime(new Date("2025-06-02"));

            const result = dateFormatter("-", "en");

            expect(result.toLowerCase()).toMatch(/may/);
        });

        it("returns the previous month name when day is 3", () => {
            jest.setSystemTime(new Date("2025-06-03"));

            const result = dateFormatter("-", "en");

            expect(result.toLowerCase()).toMatch(/may/);
        });

        it("rolls back to December when day=1 and month=January", () => {
            jest.setSystemTime(new Date("2025-01-01"));

            const result = dateFormatter("-", "en");

            expect(result.toLowerCase()).toMatch(/dec/);
        });

        it("rolls back to January when day=2 and month=February", () => {
            jest.setSystemTime(new Date("2025-02-02"));

            const result = dateFormatter("-", "en");

            expect(result.toLowerCase()).toMatch(/jan/);
        });
    });

    describe("rollbackNearMonthStart param (Accounting vs Inventory)", () => {
        it("defaults to true — omitting the 3rd arg still rolls back on day <= 3 (Inventory's call site)", () => {
            jest.setSystemTime(new Date("2025-06-02"));

            const result = dateFormatter("-", "en");

            expect(result.toLowerCase()).toMatch(/may/);
        });

        it("rolls back when explicitly passed true, on day <= 3", () => {
            jest.setSystemTime(new Date("2025-06-02"));

            const result = dateFormatter("-", "en", true);

            expect(result.toLowerCase()).toMatch(/may/);
        });

        it("does NOT roll back when passed false, even on day <= 3 (Accounting's call site)", () => {
            jest.setSystemTime(new Date("2025-06-02"));

            const result = dateFormatter("-", "en", false);

            expect(result.toLowerCase()).toMatch(/jun/);
        });

        it("does not roll back when passed false on day 1, across a January→December year boundary", () => {
            jest.setSystemTime(new Date("2025-01-01"));

            const result = dateFormatter("-", "en", false);

            expect(result.toLowerCase()).toMatch(/jan/);
            expect(result).toMatch(/25$/);
        });

        it("still behaves normally on mid-month days regardless of the flag's value", () => {
            jest.setSystemTime(new Date("2025-06-15"));

            expect(dateFormatter("-", "en", false).toLowerCase()).toMatch(/jun/);
            expect(dateFormatter("-", "en", true).toLowerCase()).toMatch(/jun/);
        });
    });

    describe("year in output", () => {
        it("includes the two-digit year for 2025", () => {
            jest.setSystemTime(new Date("2025-06-15"));

            const result = dateFormatter("-", "en");

            expect(result).toMatch(/25$/);
        });

        it("includes 2024 when rolling back from January 2025 to December 2024", () => {
            jest.setSystemTime(new Date("2025-01-02"));

            const result = dateFormatter("-", "en");

            expect(result).toMatch(/24$/);
        });
    });
});
