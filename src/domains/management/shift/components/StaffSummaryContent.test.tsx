import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import type { MonthlyShiftReport, StaffShiftSummary } from "../types";
import { StaffSummaryContent } from "./StaffSummaryContent";

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/management.ts
jest.mock("../../../../shared/api/management");

import { getMonthlyShiftReport } from "../../../../shared/api/management";

const mockGetMonthlyShiftReport = jest.mocked(getMonthlyShiftReport);

function makeSummary(overrides: Partial<StaffShiftSummary> = {}): StaffShiftSummary {
    return {
        staffId: 1,
        username: "riley.cook",
        fullName: null,
        role: "COOK",
        pricePerHour: 3,
        regularHours: 10,
        overtimeHours: 0,
        totalHours: 10,
        regularCost: 30,
        overtimeCost: 0,
        totalCost: 30,
        ...overrides,
    };
}

function makeReport(summaries: StaffShiftSummary[]): MonthlyShiftReport {
    return {
        yearMonth: "2026-08",
        branchNo: 1,
        summaries,
    };
}

describe("StaffSummaryContent", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // fullName is a recent backend addition; existing rows may not be backfilled, so the Staff
    // column must fall back to username rather than ever rendering blank.
    it("shows fullName with username as a secondary line when fullName is present", async () => {
        mockGetMonthlyShiftReport.mockResolvedValue(
            makeReport([makeSummary({ staffId: 1, username: "riley.cook", fullName: "Riley Cook" })])
        );

        render(<StaffSummaryContent branchId="branch-1" />);

        await waitFor(() => expect(screen.getByText("Riley Cook")).toBeTruthy());
        expect(screen.getByText("riley.cook")).toBeTruthy();
    });

    it("falls back to username as the primary label when fullName is null", async () => {
        mockGetMonthlyShiftReport.mockResolvedValue(
            makeReport([makeSummary({ staffId: 2, username: "zara.manager", fullName: null })])
        );

        render(<StaffSummaryContent branchId="branch-1" />);

        await waitFor(() => expect(screen.getAllByText("zara.manager").length).toBeGreaterThan(0));
    });
});
