import { jest, describe, it, expect, beforeEach, afterAll, beforeAll } from "@jest/globals";
import React from "react";
import { act, render, screen, waitFor, fireEvent, within } from "@testing-library/react";
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
        periodStart: "2026-07-25",
        periodEnd: "2026-08-24",
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
    // The popup copies the form into its fields in an effect that can still be pending when the
    // button first shows, so wait for a copied value rather than the button.
    await waitFor(() => expect(input("slip-employee-name").value).not.toBe(""));
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
        basicSalary: 240,
        allowance: 40,
        totalSalary: 280,
        ...overrides,
    };
}

function makeReport(summaries: StaffShiftSummary[]): MonthlyShiftReport {
    return {
        yearMonth: "2026-08",
        branchNo: 1,
        periodStart: "2026-08-01",
        periodEnd: "2026-08-31",
        summaries,
    };
}

function input(testId: string): HTMLInputElement {
    return screen.getByTestId(testId).querySelector("input") as HTMLInputElement;
}

// The popup renders its own From/To with the same test ids, so its fields are scoped to the sheet.
function popupInput(testId: string): HTMLInputElement {
    return within(screen.getByTestId("salary-slip-popup")).getByTestId(testId)
        .querySelector("input") as HTMLInputElement;
}

function monthInput(container: HTMLElement): HTMLInputElement {
    return container.querySelector('input[type="month"]') as HTMLInputElement;
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

    // Total Salary replaced Total Cost: the header label and the pill breakdown must reflect
    // Basic Salary + Allowance + OT, not the old hourly-rate total.
    it("renders the Total Salary header and the headline + breakdown numbers from payroll fields", async () => {
        mockGetMonthlyShiftReport.mockResolvedValue(
            makeReport([makeSummary({
                staffId: 10,
                username: "payroll.set",
                basicSalary: 240,
                allowance: 40,
                overtimeHours: 2,
                totalHours: 12,
                overtimeCost: 6,
                totalSalary: 286,
            })])
        );

        render(<StaffSummaryContent branchId="branch-1" role={null} />);

        await waitFor(() => expect(screen.getByText("Total(Basic Salary + Allowance + OT)")).toBeTruthy());
        expect(screen.queryByText("Total Cost")).toBeNull();
        expect(screen.getByText("286.000")).toBeTruthy();
        expect(screen.getByText("(240.000 + 40.000 + 6.000 OT)")).toBeTruthy();
    });

    // A monthly-salaried staff member can have no hourly rate at all, which is a different null
    // condition than "no payroll configured": the backend gates basicSalary/allowance/totalSalary
    // together on basicSalary != null, but gates overtimeCost independently on pricePerHour != null.
    // So totalSalary can be non-null while overtimeCost is null -- the breakdown must still print
    // "0.000" for the OT term (matching the backend's own nz() treatment), not leave it blank.
    it("renders 0.000 for the OT term when overtimeCost is null but totalSalary is not", async () => {
        mockGetMonthlyShiftReport.mockResolvedValue(
            makeReport([makeSummary({
                staffId: 12,
                username: "salaried.no.hourly",
                pricePerHour: null,
                basicSalary: 240,
                allowance: 40,
                overtimeCost: null,
                totalSalary: 280,
            })])
        );

        render(<StaffSummaryContent branchId="branch-1" role={null} />);

        await waitFor(() => expect(screen.getByText("280.000")).toBeTruthy());
        expect(screen.getByText("(240.000 + 40.000 + 0.000 OT)")).toBeTruthy();
    });

    // Non-OWNER viewers (or staff with no payroll configured yet) get null payroll fields from
    // the backend -- the pill must fall back to "—" with no breakdown, same as the old totalCost gate.
    it("shows a dash and no breakdown when payroll fields are null", async () => {
        mockGetMonthlyShiftReport.mockResolvedValue(
            makeReport([makeSummary({
                staffId: 11,
                username: "payroll.unset",
                basicSalary: null,
                allowance: null,
                totalSalary: null,
            })])
        );

        render(<StaffSummaryContent branchId="branch-1" role={null} />);

        await waitFor(() => expect(screen.getAllByText("—").length).toBeGreaterThan(0));
        // Distinguish from the "Total(Basic Salary + Allowance + OT)" header, which also ends in
        // "OT)" but has no formatted numbers -- the breakdown pill would read e.g. "(0.000 + ... OT)".
        expect(screen.queryByText(/\d\.\d{3}.*OT\)/)).toBeNull();
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

    // ── Date range ───────────────────────────────────────────────────────────────
    // The default window is the backend's decision; the UI only ever renders what came back.

    it("shows the window the backend summed in the From/To fields", async () => {
        mockGetMonthlyShiftReport.mockResolvedValue(makeReport([makeSummary()]));

        render(<StaffSummaryContent branchId="branch-1" role={null} />);

        await waitFor(() => expect(input("shift-range-from").value).toBe("2026-08-01"));
        expect(input("shift-range-to").value).toBe("2026-08-31");
        expect(mockGetMonthlyShiftReport.mock.calls[0][2]).toBeUndefined();
    });

    it("re-fetches the summary for the picked range when a date is edited", async () => {
        mockGetMonthlyShiftReport.mockResolvedValue(makeReport([makeSummary()]));

        render(<StaffSummaryContent branchId="branch-1" role={null} />);
        await waitFor(() => expect(input("shift-range-from").value).toBe("2026-08-01"));
        fireEvent.change(input("shift-range-from"), { target: { value: "2026-08-10" } });

        await waitFor(() => expect(mockGetMonthlyShiftReport).toHaveBeenCalledTimes(2));
        const [branchId, , range] = mockGetMonthlyShiftReport.mock.calls[1];
        expect(branchId).toBe("branch-1");
        expect(range).toEqual({ from: "2026-08-10", to: "2026-08-31" });
        await waitFor(() => expect(input("shift-range-from").disabled).toBe(false));
        expect(input("shift-range-from").value).toBe("2026-08-10");
    });

    it("locks the date fields while the summary for the picked range loads", async () => {
        let resolveReport: (value: MonthlyShiftReport) => void = () => {};
        mockGetMonthlyShiftReport
            .mockResolvedValueOnce(makeReport([makeSummary()]))
            .mockImplementationOnce(() => new Promise((resolve) => { resolveReport = resolve; }));

        render(<StaffSummaryContent branchId="branch-1" role={null} />);
        await waitFor(() => expect(input("shift-range-from").value).toBe("2026-08-01"));
        fireEvent.change(input("shift-range-from"), { target: { value: "2026-08-10" } });

        await waitFor(() => expect(input("shift-range-from").disabled).toBe(true));
        expect(input("shift-range-to").disabled).toBe(true);

        resolveReport({ ...makeReport([makeSummary()]), periodStart: "2026-08-10" });

        await waitFor(() => expect(input("shift-range-from").disabled).toBe(false));
        expect(input("shift-range-to").disabled).toBe(false);
    });

    // A picked range belongs to the month it was picked in; a new month starts from the backend's
    // default again.
    it("drops the picked range when the month changes", async () => {
        mockGetMonthlyShiftReport.mockResolvedValue(makeReport([makeSummary()]));

        const { container } = render(<StaffSummaryContent branchId="branch-1" role={null} />);
        await waitFor(() => expect(input("shift-range-from").value).toBe("2026-08-01"));
        fireEvent.change(input("shift-range-from"), { target: { value: "2026-08-10" } });
        await waitFor(() => expect(mockGetMonthlyShiftReport).toHaveBeenCalledTimes(2));
        await waitFor(() => expect(input("shift-range-from").disabled).toBe(false));
        fireEvent.change(monthInput(container), { target: { value: "2020-01" } });

        await waitFor(() => expect(mockGetMonthlyShiftReport).toHaveBeenCalledTimes(3));
        const [, yearMonth, range] = mockGetMonthlyShiftReport.mock.calls[2];
        expect(yearMonth).toBe("2020-01");
        expect(range).toBeUndefined();
    });

    // The previous report is dropped when a fetch starts, so a failure can never leave the last
    // month's window on screen as if it were this one's.
    it("leaves the date fields empty rather than showing a stale window when a fetch fails", async () => {
        mockGetMonthlyShiftReport
            .mockResolvedValueOnce(makeReport([makeSummary()]))
            .mockRejectedValueOnce(new Error("Response: 500"));

        const { container } = render(<StaffSummaryContent branchId="branch-1" role={null} />);
        await waitFor(() => expect(input("shift-range-from").value).toBe("2026-08-01"));
        fireEvent.change(monthInput(container), { target: { value: "2020-01" } });

        await waitFor(() => expect(screen.getByText("Response: 500")).toBeTruthy());
        expect(input("shift-range-from").value).toBe("");
        expect(input("shift-range-to").value).toBe("");
    });

    // The slip has its own default window (the pay cycle), so a row click never forwards the
    // summary's picked range.
    it("opens the slip on the backend's default window even after the summary's range was edited", async () => {
        mockGetMonthlyShiftReport.mockResolvedValue(
            makeReport([makeSummary({ staffId: 6, username: "owner.viewer" })])
        );
        mockGetSalarySlipPreview.mockResolvedValue(makeSlipForm());

        render(<StaffSummaryContent branchId="branch-1" role={StaffRoles.OWNER} />);
        await waitFor(() => expect(input("shift-range-from").value).toBe("2026-08-01"));
        fireEvent.change(input("shift-range-from"), { target: { value: "2026-08-10" } });
        await waitFor(() => expect(mockGetMonthlyShiftReport).toHaveBeenCalledTimes(2));
        await openSlipPopup();

        expect(mockGetSalarySlipPreview).toHaveBeenCalledTimes(1);
        const [staffId, , range] = mockGetSalarySlipPreview.mock.calls[0];
        expect(staffId).toBe(6);
        expect(range).toBeUndefined();
        expect(popupInput("shift-range-from").value).toBe("2026-07-25");
        expect(popupInput("shift-range-to").value).toBe("2026-08-24");
    });

    it("reloads the slip preview for the dates picked in the popup, discarding earlier edits", async () => {
        mockGetMonthlyShiftReport.mockResolvedValue(
            makeReport([makeSummary({ staffId: 6, username: "owner.viewer" })])
        );
        mockGetSalarySlipPreview
            .mockResolvedValueOnce(makeSlipForm())
            .mockResolvedValueOnce(makeSlipForm({ periodStart: "2026-07-20" }));

        render(<StaffSummaryContent branchId="branch-1" role={StaffRoles.OWNER} />);
        await openSlipPopup();
        fireEvent.change(screen.getByTestId("slip-basic").querySelector("input") as HTMLInputElement,
            { target: { value: "300" } });
        fireEvent.change(popupInput("shift-range-from"), { target: { value: "2026-07-20" } });

        await waitFor(() => expect(mockGetSalarySlipPreview).toHaveBeenCalledTimes(2));
        const [staffId, , range] = mockGetSalarySlipPreview.mock.calls[1];
        expect(staffId).toBe(6);
        expect(range).toEqual({ from: "2026-07-20", to: "2026-08-24" });
        await waitFor(() => expect(input("slip-basic").value).toBe("240"));
        expect(popupInput("shift-range-from").value).toBe("2026-07-20");
    });

    // Leaving a typed date blurs it on the mousedown of the next click, so the reload starts before
    // that click lands; the sheet's buttons must still be there to receive it.
    it("still closes on Cancel when leaving a typed date starts a reload", async () => {
        mockGetMonthlyShiftReport.mockResolvedValue(
            makeReport([makeSummary({ staffId: 6, username: "owner.viewer" })])
        );
        mockGetSalarySlipPreview
            .mockResolvedValueOnce(makeSlipForm())
            .mockImplementationOnce(() => new Promise(() => {}));

        render(<StaffSummaryContent branchId="branch-1" role={StaffRoles.OWNER} />);
        await openSlipPopup();
        fireEvent.keyDown(popupInput("shift-range-from"), { key: "2" });
        fireEvent.change(popupInput("shift-range-from"), { target: { value: "2026-07-20" } });
        fireEvent.blur(popupInput("shift-range-from"));

        expect(mockGetSalarySlipPreview).toHaveBeenCalledTimes(2);
        expect((screen.getByTestId("slip-confirm") as HTMLButtonElement).disabled).toBe(true);
        fireEvent.click(screen.getByText("Cancel"));

        await waitFor(() => expect(screen.queryByTestId("slip-confirm")).toBeNull());
    });

    // Otherwise the popup is left with a bare error and no date fields to correct the range with.
    it("keeps the current slip and its dates when the server rejects the picked range", async () => {
        mockGetMonthlyShiftReport.mockResolvedValue(
            makeReport([makeSummary({ staffId: 6, username: "owner.viewer" })])
        );
        mockGetSalarySlipPreview
            .mockResolvedValueOnce(makeSlipForm())
            .mockRejectedValueOnce(new Error("HTTP 400"));

        render(<StaffSummaryContent branchId="branch-1" role={StaffRoles.OWNER} />);
        await openSlipPopup();
        fireEvent.change(popupInput("shift-range-from"), { target: { value: "2026-05-01" } });

        await waitFor(() => expect(screen.getByTestId("salary-slip-error").textContent).toBe("HTTP 400"));
        expect(popupInput("shift-range-from").value).toBe("2026-07-25");
        expect(popupInput("shift-range-to").value).toBe("2026-08-24");
        expect(popupInput("shift-range-from").disabled).toBe(false);
    });

    // A preview still in flight when its popup closes must not land in the next employee's slip --
    // Confirm would then POST one employee's figures to another's endpoint.
    it("ignores a slip preview that arrives after its popup was closed", async () => {
        mockGetMonthlyShiftReport.mockResolvedValue(makeReport([
            makeSummary({ staffId: 6, username: "alice.adams", fullName: "Alice Adams" }),
            makeSummary({ staffId: 7, username: "bob.baker", fullName: "Bob Baker" }),
        ]));
        let resolveLatePreview: (value: SalarySlipForm) => void = () => {};
        mockGetSalarySlipPreview
            .mockResolvedValueOnce(makeSlipForm({ employeeName: "Alice Adams" }))
            .mockImplementationOnce(() => new Promise((resolve) => { resolveLatePreview = resolve; }))
            .mockResolvedValueOnce(makeSlipForm({ employeeName: "Bob Baker" }));

        render(<StaffSummaryContent branchId="branch-1" role={StaffRoles.OWNER} />);
        await waitFor(() => expect(screen.getAllByLabelText("Salary slip")).toHaveLength(2));
        fireEvent.click(screen.getAllByLabelText("Salary slip")[0]);
        await waitFor(() => expect(screen.getByTestId("slip-confirm")).toBeTruthy());
        fireEvent.change(popupInput("shift-range-from"), { target: { value: "2026-07-20" } });
        fireEvent.click(screen.getByText("Cancel"));
        fireEvent.click(screen.getAllByLabelText("Salary slip")[1]);
        await waitFor(() => expect(input("slip-employee-name").value).toBe("Bob Baker"));

        await act(async () => {
            resolveLatePreview(makeSlipForm({ employeeName: "Alice Adams" }));
        });

        expect(input("slip-employee-name").value).toBe("Bob Baker");
        expect(screen.queryByTestId("salary-slip-loading")).toBeNull();
    });
});
