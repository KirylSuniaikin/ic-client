import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { render, screen, waitFor, within } from "@testing-library/react";
import { fetchMyDiscipline, fetchMyWorkSummary } from "../../../../shared/api/management";
import MyProfileDrawer from "./MyProfileDrawer";
import { makeRecord, makeViolation } from "../testFixtures";
import { StaffRoles } from "../../../auth/types";
import type { DisputeTO, MyWorkSummaryTO, StaffDisciplineTO } from "../types";

jest.mock("../../../../shared/api/management");

const mockMine = jest.mocked(fetchMyDiscipline);
const mockWork = jest.mocked(fetchMyWorkSummary);

const SUMMARY: MyWorkSummaryTO = {
    periodStart: "2026-09-25", periodEnd: "2026-10-24", totalHours: 80, totalCost: null, totalSalary: null,
};
const OPEN_DISPUTE: DisputeTO = {
    reason: "x", disputedAt: "2026-10-07T12:00:00", outcome: null,
    resolvedByName: null, resolvedAt: null, resolutionNote: null,
};
// 2026-10-08 12:00 Bahrain; explanationDueAt strings are Bahrain-local.
const NOW = Date.parse("2026-10-08T12:00:00+03:00");

function renderDrawer(open = true): void {
    render(<MyProfileDrawer open={open} onClose={jest.fn()} userName="Casey" role={StaffRoles.COOK} />);
}

function pending(overrides: Partial<StaffDisciplineTO["violations"][number]>): StaffDisciplineTO {
    return makeRecord({
        violations: [makeViolation({ id: 8, status: "PENDING_EXPLANATION", explainedAt: null, ...overrides })],
    });
}

beforeEach(() => {
    mockMine.mockReset();
    mockWork.mockReset();
    jest.spyOn(Date, "now").mockReturnValue(NOW);
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe("MyProfileDrawer", () => {
    it("fetches nothing while closed", () => {
        renderDrawer(false);

        expect(mockMine).not.toHaveBeenCalled();
        expect(mockWork).not.toHaveBeenCalled();
    });

    it("shows the user name and a loading indicator while fetching", () => {
        mockMine.mockReturnValue(new Promise(() => undefined));
        mockWork.mockReturnValue(new Promise(() => undefined));
        renderDrawer();

        expect(screen.getByText("Casey")).toBeTruthy();
        expect(screen.getByRole("progressbar")).toBeTruthy();
    });

    it("renders score, work card and the sections, hiding History when it is empty", async () => {
        mockMine.mockResolvedValue(makeRecord({ score: 82, zone: "GREEN", violations: [] }));
        mockWork.mockResolvedValue(SUMMARY);
        renderDrawer();

        await waitFor(() => expect(screen.getByTestId("my-profile-score").textContent).toBe("82"));
        expect(screen.getByTestId("profile-zone-pill").textContent).toBe("Green zone");
        expect(screen.getByTestId("profile-hours").textContent).toBe("80.00");
        expect(screen.getByTestId("profile-active-count").textContent).toBe("0");
        expect(screen.getByText("Casey")).toBeTruthy();
        expect(screen.getByText("cook at IC Pizza")).toBeTruthy();
        expect(await screen.findByTestId("last-month-work-card")).toBeTruthy();
        expect(screen.getByText("Active violations")).toBeTruthy();
        expect(screen.getByText("No active violations")).toBeTruthy();
        expect(screen.queryByText("History")).toBeNull();
        expect(screen.queryByText("No violations on record")).toBeNull();
        expect(screen.queryByText("Awaiting your explanation")).toBeNull();
    });

    it("shows no penalty-hour totals", async () => {
        mockMine.mockResolvedValue(makeRecord({ penaltyHoursInCycle: 3 }));
        mockWork.mockResolvedValue(SUMMARY);
        renderDrawer();

        await screen.findByText("Active violations");
        expect(screen.queryByText(/penalty/i)).toBeNull();
    });

    it("offers Dispute only on disputable active violations", async () => {
        mockMine.mockResolvedValue(makeRecord({
            violations: [
                makeViolation({ id: 1 }),
                makeViolation({ id: 2, violationClass: "D" }),
                makeViolation({ id: 3, dispute: OPEN_DISPUTE }),
                makeViolation({ id: 4, expired: true }),
                makeViolation({ id: 5, status: "CANCELLED" }),
            ],
        }));
        mockWork.mockResolvedValue(SUMMARY);
        renderDrawer();

        await screen.findByTestId("my-active-violation-1");
        expect(screen.getAllByRole("button", { name: "Dispute" })).toHaveLength(1);
        expect(within(screen.getByTestId("my-active-violation-1")).queryByRole("button", { name: "Dispute" })).not.toBeNull();
        expect(within(screen.getByTestId("my-active-violation-2")).queryByRole("button", { name: "Dispute" })).toBeNull();
        expect(within(screen.getByTestId("my-active-violation-3")).queryByRole("button", { name: "Dispute" })).toBeNull();
        expect(screen.queryByTestId("my-active-violation-4")).toBeNull();
        expect(screen.queryByTestId("my-active-violation-5")).toBeNull();
    });

    it("shows the explanation form for an unexplained pending violation inside its window", async () => {
        mockMine.mockResolvedValue(pending({ explanationDueAt: "2026-10-09T12:00:00" }));
        mockWork.mockResolvedValue(SUMMARY);
        renderDrawer();

        expect(await screen.findByText("Awaiting your explanation")).toBeTruthy();
        expect(screen.getByLabelText("Your explanation")).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Dispute" })).toBeNull();
    });

    it("hides the form once the window has closed and shows the closed text", async () => {
        mockMine.mockResolvedValue(pending({ explanationDueAt: "2026-10-08T11:00:00" }));
        mockWork.mockResolvedValue(SUMMARY);
        renderDrawer();

        await screen.findByText("Awaiting your explanation");
        expect(screen.queryByLabelText("Your explanation")).toBeNull();
        expect(screen.getAllByText("Explanation window closed — awaiting GM").length).toBeGreaterThan(0);
    });

    it("hides the form once the violation is already explained", async () => {
        mockMine.mockResolvedValue(pending({
            explanationDueAt: "2026-10-09T12:00:00",
            explainedAt: "2026-10-08T09:00:00",
            employeeExplanation: "done",
        }));
        mockWork.mockResolvedValue(SUMMARY);
        renderDrawer();

        await screen.findByText("Awaiting your explanation");
        expect(screen.queryByLabelText("Your explanation")).toBeNull();
    });

    it("lists every violation under History", async () => {
        mockMine.mockResolvedValue(makeRecord({
            violations: [makeViolation({ id: 1 }), makeViolation({ id: 2, status: "CANCELLED" })],
        }));
        mockWork.mockResolvedValue(SUMMARY);
        renderDrawer();

        await screen.findByTestId("my-history-violation-1");
        expect(screen.getByTestId("my-history-violation-2")).toBeTruthy();
    });

    it("shows a discipline error but still renders the work summary", async () => {
        mockMine.mockRejectedValue(new Error("Discipline down"));
        mockWork.mockResolvedValue(SUMMARY);
        renderDrawer();

        expect((await screen.findByRole("alert")).textContent).toBe("Discipline down");
        expect(await screen.findByTestId("last-month-work-card")).toBeTruthy();
        expect(screen.queryByText("Active violations")).toBeNull();
    });

    it("shows a work-summary error but still renders the discipline data", async () => {
        mockMine.mockResolvedValue(makeRecord({ score: 70 }));
        mockWork.mockRejectedValue(new Error("Work down"));
        renderDrawer();

        await waitFor(() => expect(screen.getByTestId("my-profile-score").textContent).toBe("70"));
        await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Work down"));
        expect(screen.queryByTestId("last-month-work-card")).toBeNull();
        expect(screen.getByText("Active violations")).toBeTruthy();
    });
});
