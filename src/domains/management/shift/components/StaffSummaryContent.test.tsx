import { jest, describe, it, expect, beforeEach, afterAll, beforeAll } from "@jest/globals";
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import type { MonthlyShiftReport, StaffShiftSummary } from "../types";
import { StaffRoles } from "../../../auth/types";
import { StaffSummaryContent } from "./StaffSummaryContent";

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/management.ts
jest.mock("../../../../shared/api/management");

// @capacitor/core is a real node_modules package, not a project module -- there is no
// __mocks__ twin for it. `mockIsNativePlatform` must keep the "mock" prefix: babel-plugin-jest-hoist
// only allows a jest.mock() factory to close over out-of-scope variables named that way. Defaults
// to the web build (false) for every test except the one exercising the native gate itself.
let mockIsNativePlatform = false;
jest.mock("@capacitor/core", () => ({
    Capacitor: { isNativePlatform: () => mockIsNativePlatform },
}));

import { getMonthlyShiftReport, downloadSalarySlip, getSalarySlipPreview } from "../../../../shared/api/management";
import type { SalarySlipForm } from "../types";

const mockGetMonthlyShiftReport = jest.mocked(getMonthlyShiftReport);
const mockDownloadSalarySlip = jest.mocked(downloadSalarySlip);
const mockGetSalarySlipPreview = jest.mocked(getSalarySlipPreview);

// The slip is now confirmed in a popup before it downloads, so every download test first opens
// the popup on these previewed defaults.
function makeSlipForm(overrides: Partial<SalarySlipForm> = {}): SalarySlipForm {
    return {
        employeeName: "Casey Cook",
        position: "Cook",
        cprNumber: "850012345",
        payPeriodLabel: "August 2026",
        paymentDate: "2026-08-31",
        basicSalary: 240,
        housingAllowance: 40,
        transportAllowance: null,
        overtimeHours: 4,
        overtimeRate: 1.5,
        overtimeAmount: 6,
        deductions: [],
        grossEarnings: 286,
        totalDeductions: 0,
        netPay: 286,
        amountInWords: "Bahraini Dinars Two Hundred Eighty Six Only",
        notes: ["1. Basic Salary of BD 240.000 paid in full with no deduction."],
        ...overrides,
    };
}

async function openSlipPopup(): Promise<void> {
    await waitFor(() => expect(screen.getByLabelText("Salary slip")).toBeTruthy());
    fireEvent.click(screen.getByLabelText("Salary slip"));
    await waitFor(() => expect(screen.getByTestId("slip-confirm")).toBeTruthy());
}

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

const createdUrls: string[] = [];
const revokedUrls: string[] = [];
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

beforeAll(() => {
    URL.createObjectURL = (_obj: Blob | MediaSource): string => {
        const url = `blob:mock-${createdUrls.length}`;
        createdUrls.push(url);
        return url;
    };
    URL.revokeObjectURL = (url: string): void => {
        revokedUrls.push(url);
    };
});

afterAll(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
});

describe("StaffSummaryContent", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockIsNativePlatform = false;
        createdUrls.length = 0;
        revokedUrls.length = 0;
    });

    // fullName is a recent backend addition; existing rows may not be backfilled, so the Staff
    // column must fall back to username rather than ever rendering blank.
    it("shows fullName with username as a secondary line when fullName is present", async () => {
        mockGetMonthlyShiftReport.mockResolvedValue(
            makeReport([makeSummary({ staffId: 1, username: "riley.cook", fullName: "Riley Cook" })])
        );

        render(<StaffSummaryContent branchId="branch-1" role={null} />);

        await waitFor(() => expect(screen.getByText("Riley Cook")).toBeTruthy());
        expect(screen.getByText("riley.cook")).toBeTruthy();
    });

    it("falls back to username as the primary label when fullName is null", async () => {
        mockGetMonthlyShiftReport.mockResolvedValue(
            makeReport([makeSummary({ staffId: 2, username: "zara.manager", fullName: null })])
        );

        render(<StaffSummaryContent branchId="branch-1" role={null} />);

        await waitFor(() => expect(screen.getAllByText("zara.manager").length).toBeGreaterThan(0));
    });

    it("renders the salary slip button for OWNER", async () => {
        mockGetMonthlyShiftReport.mockResolvedValue(
            makeReport([makeSummary({ staffId: 3, username: "owner.viewer" })])
        );

        render(<StaffSummaryContent branchId="branch-1" role={StaffRoles.OWNER} />);

        await waitFor(() => expect(screen.getByLabelText("Salary slip")).toBeTruthy());
    });

    it("does not render the salary slip button for a MANAGER", async () => {
        mockGetMonthlyShiftReport.mockResolvedValue(
            makeReport([makeSummary({ staffId: 4, username: "manager.viewer" })])
        );

        render(<StaffSummaryContent branchId="branch-1" role={StaffRoles.MANAGER} />);

        await waitFor(() => expect(screen.getAllByText("manager.viewer").length).toBeGreaterThan(0));
        expect(screen.queryByLabelText("Salary slip")).toBeNull();
    });

    it("hides the salary slip button inside the Capacitor native shell even for OWNER", async () => {
        mockIsNativePlatform = true;
        mockGetMonthlyShiftReport.mockResolvedValue(
            makeReport([makeSummary({ staffId: 5, username: "native.owner" })])
        );

        render(<StaffSummaryContent branchId="branch-1" role={StaffRoles.OWNER} />);

        await waitFor(() => expect(screen.getAllByText("native.owner").length).toBeGreaterThan(0));
        expect(screen.queryByLabelText("Salary slip")).toBeNull();
    });

    // The component seeds yearMonth from dayjs() at render time (production code, untouched here),
    // so the clock is pinned to a fixed instant rather than hardcoding "today's" month — otherwise
    // this test self-destructs on the 1st of every month for everyone who runs the gate.
    it("opens the confirm popup pre-filled with the previewed slip rather than downloading straight away", async () => {
        mockGetMonthlyShiftReport.mockResolvedValue(
            makeReport([makeSummary({ staffId: 6, username: "owner.viewer" })])
        );
        mockGetSalarySlipPreview.mockResolvedValue(makeSlipForm());

        render(<StaffSummaryContent branchId="branch-1" role={StaffRoles.OWNER} />);
        await openSlipPopup();

        expect((screen.getByTestId("slip-employee-name").querySelector("input") as HTMLInputElement).value)
            .toBe("Casey Cook");
        expect(mockDownloadSalarySlip).not.toHaveBeenCalled();
    });

    // The clock is pinned to a fixed instant rather than hardcoding "today's" month -- otherwise
    // this test self-destructs on the 1st of every month for everyone who runs the gate.
    it("downloads the slip via an object URL once the popup is confirmed", async () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date("2026-08-15T10:00:00.000Z"));
        mockGetMonthlyShiftReport.mockResolvedValue(
            makeReport([makeSummary({ staffId: 6, username: "owner.viewer" })])
        );
        mockGetSalarySlipPreview.mockResolvedValue(makeSlipForm());
        const blob = new Blob(["%PDF-"], { type: "application/pdf" });
        mockDownloadSalarySlip.mockResolvedValue({ blob, filename: "Salary_Slip_Aug2026.pdf" });

        render(<StaffSummaryContent branchId="branch-1" role={StaffRoles.OWNER} />);
        await openSlipPopup();
        fireEvent.click(screen.getByTestId("slip-confirm"));

        await waitFor(() => expect(mockDownloadSalarySlip).toHaveBeenCalled());
        const [staffId, yearMonth] = mockDownloadSalarySlip.mock.calls[0];
        expect(staffId).toBe(6);
        expect(yearMonth).toBe("2026-08");
        await waitFor(() => expect(revokedUrls.length).toBeGreaterThan(0));
        expect(createdUrls.length).toBeGreaterThan(0);

        jest.useRealTimers();
    });

    // What the owner corrected in the popup is what must be sent, not the previewed default.
    it("sends the owner's edits rather than the previewed defaults", async () => {
        mockGetMonthlyShiftReport.mockResolvedValue(
            makeReport([makeSummary({ staffId: 6, username: "owner.viewer" })])
        );
        mockGetSalarySlipPreview.mockResolvedValue(makeSlipForm());
        mockDownloadSalarySlip.mockResolvedValue({
            blob: new Blob(["%PDF-"]), filename: "Salary_Slip_Aug2026.pdf",
        });

        render(<StaffSummaryContent branchId="branch-1" role={StaffRoles.OWNER} />);
        await openSlipPopup();
        fireEvent.change(screen.getByTestId("slip-basic").querySelector("input") as HTMLInputElement,
            { target: { value: "300" } });
        fireEvent.click(screen.getByTestId("slip-confirm"));

        await waitFor(() => expect(mockDownloadSalarySlip).toHaveBeenCalled());
        const form = mockDownloadSalarySlip.mock.calls[0][2];
        expect(form.basicSalary).toBe(300);
        // Gross follows the rows unless it is itself overridden: 300 + 40 + 6.
        expect(form.grossEarnings).toBe(346);
    });

    it("shows the payroll-not-set message inside the popup when the preview 409s", async () => {
        mockGetMonthlyShiftReport.mockResolvedValue(
            makeReport([makeSummary({ staffId: 7, username: "owner.viewer" })])
        );
        mockGetSalarySlipPreview.mockRejectedValue(new Error("HTTP 409"));

        render(<StaffSummaryContent branchId="branch-1" role={StaffRoles.OWNER} />);
        await waitFor(() => expect(screen.getByLabelText("Salary slip")).toBeTruthy());
        fireEvent.click(screen.getByLabelText("Salary slip"));

        await waitFor(() =>
            expect(
                screen.getByText("Set this employee's payroll in Account Manager first.")
            ).toBeTruthy()
        );
        expect(mockDownloadSalarySlip).not.toHaveBeenCalled();
    });

    // useAuthImageUrl.ts's whole point is that a leaked object URL is heap that never frees
    // itself -- so it is not enough that *some* URL got revoked, it must be the exact one that
    // was created for this download, and it must be revoked exactly once.
    it("revokes the exact object URL it created for the download, not an arbitrary one", async () => {
        mockGetMonthlyShiftReport.mockResolvedValue(
            makeReport([makeSummary({ staffId: 8, username: "owner.viewer" })])
        );
        mockGetSalarySlipPreview.mockResolvedValue(makeSlipForm());
        const blob = new Blob(["%PDF-"], { type: "application/pdf" });
        mockDownloadSalarySlip.mockResolvedValue({ blob, filename: "Salary_Slip_Aug2026.pdf" });

        render(<StaffSummaryContent branchId="branch-1" role={StaffRoles.OWNER} />);
        await openSlipPopup();
        fireEvent.click(screen.getByTestId("slip-confirm"));

        await waitFor(() => expect(revokedUrls.length).toBe(1));
        expect(createdUrls).toEqual([revokedUrls[0]]);
    });

    it("disables the confirm button while the slip is being generated", async () => {
        mockGetMonthlyShiftReport.mockResolvedValue(
            makeReport([makeSummary({ staffId: 9, username: "first.owner" })])
        );
        mockGetSalarySlipPreview.mockResolvedValue(makeSlipForm());
        let resolveDownload: (value: { blob: Blob; filename: string }) => void = () => {};
        mockDownloadSalarySlip.mockImplementation(
            () => new Promise((resolve) => { resolveDownload = resolve; })
        );

        render(<StaffSummaryContent branchId="branch-1" role={StaffRoles.OWNER} />);
        await openSlipPopup();
        const confirm = screen.getByTestId("slip-confirm");
        fireEvent.click(confirm);

        await waitFor(() => expect(confirm.hasAttribute("disabled")).toBe(true));

        resolveDownload({ blob: new Blob(["%PDF-"]), filename: "Salary_Slip_Aug2026.pdf" });

        await waitFor(() => expect(screen.queryByTestId("slip-confirm")).toBeNull());
    });

    it("sizes the empty-state cell to span all 5 columns when the slip column is shown to an OWNER", async () => {
        mockGetMonthlyShiftReport.mockResolvedValue(makeReport([]));

        render(<StaffSummaryContent branchId="branch-1" role={StaffRoles.OWNER} />);

        await waitFor(() => expect(screen.getByText("No data for this period")).toBeTruthy());
        const cell = screen.getByText("No data for this period").closest("td");
        expect(cell?.getAttribute("colspan")).toBe("5");
    });

    it("sizes the empty-state cell to span only 4 columns when the slip column is hidden", async () => {
        mockGetMonthlyShiftReport.mockResolvedValue(makeReport([]));

        render(<StaffSummaryContent branchId="branch-1" role={StaffRoles.MANAGER} />);

        await waitFor(() => expect(screen.getByText("No data for this period")).toBeTruthy());
        const cell = screen.getByText("No data for this period").closest("td");
        expect(cell?.getAttribute("colspan")).toBe("4");
    });
});
