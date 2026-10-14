import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { StaffRoles } from "../../../auth/types";
import type { StaffAdminTO } from "../../staff/types";
import type { UseStaffDisciplineResult } from "../hooks/useStaffDiscipline";
import type { DisciplinaryActionTO } from "../types";
import { makeRecord, makeViolation } from "../testFixtures";
import DisciplineDrawer from "./DisciplineDrawer";

jest.mock("../../../../shared/api/management");

const mockUseStaffDiscipline = jest.fn<UseStaffDisciplineResult, [number | null]>();
jest.mock("../hooks/useStaffDiscipline", () => ({
    useStaffDiscipline: (id: number | null) => mockUseStaffDiscipline(id),
}));

function mockIssueForm(): JSX.Element {
    return <div data-testid="form-stub" />;
}
jest.mock("./IssueViolationForm", () => ({ __esModule: true, default: mockIssueForm }));

let mockIsNativePlatform = false;
jest.mock("@capacitor/core", () => ({
    Capacitor: { isNativePlatform: () => mockIsNativePlatform },
}));

const target: StaffAdminTO = {
    id: 7, username: "casey.cook", fullName: "Casey Cook", role: StaffRoles.COOK, branchId: "b1",
    pricePerHour: null, enabled: true, cprNumber: null, basicSalary: null, housingAllowance: null,
    transportAllowance: null, telegramConnected: false,
};

const action: DisciplinaryActionTO = {
    id: 11, violationId: 2, employeeId: 7, actionLevel: "WRITTEN", scoreAtTime: 70, shadowPilot: false,
    createdAt: "2026-10-07T10:00:00", documentAvailable: true, signedAt: null, signedRecordedByName: null,
    refusalRecordedAt: null, refusalShiftChiefName: null, refusalGmName: null, voidedAt: null,
};

const violations = [
    makeViolation({ id: 1, status: "PENDING_EXPLANATION", explanationDueAt: "2099-01-01T00:00:00" }),
    makeViolation({ id: 2, status: "ACTIVE", actionId: 11 }),
    makeViolation({ id: 3, status: "ACTIVE", actionId: null }),
];

function renderDrawer(callerRole: StaffRoles) {
    return render(
        <DisciplineDrawer open target={target} callerRole={callerRole} roster={[target]} onClose={jest.fn()} onChanged={jest.fn()} />,
    );
}

beforeEach(() => {
    mockIsNativePlatform = false;
    mockUseStaffDiscipline.mockReset();
    mockUseStaffDiscipline.mockReturnValue({
        record: makeRecord({ violations, actions: [action] }), loading: false, error: null, refresh: jest.fn<void, []>(),
    });
});

describe("DisciplineDrawer review mounts", () => {
    it.each([StaffRoles.SUPER_MANAGER, StaffRoles.OWNER])("%s sees Awaiting review, Confirm and Cancel violation", (role) => {
        renderDrawer(role);

        expect(screen.getByText("Awaiting review")).toBeTruthy();
        expect(screen.getByRole("button", { name: "Confirm" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Cancel violation" })).toBeTruthy();
    });

    it("MANAGER sees no review panel, Confirm or Cancel", () => {
        renderDrawer(StaffRoles.MANAGER);

        expect(screen.queryByText("Awaiting review")).toBeNull();
        expect(screen.queryByRole("button", { name: "Confirm" })).toBeNull();
        expect(screen.queryByRole("button", { name: "Cancel violation" })).toBeNull();
        expect(screen.getByText("Awaiting explanation", { selector: "p" })).toBeTruthy();
    });

    it.each([StaffRoles.SUPER_MANAGER, StaffRoles.OWNER])("%s sees document actions only on history rows with an action", (role) => {
        renderDrawer(role);
        fireEvent.click(screen.getByTestId("discipline-tab-history"));

        expect(screen.getAllByTestId("document-actions-11")).toHaveLength(1);
        expect(screen.getAllByText("Mark signed")).toHaveLength(1);
    });

    it("MANAGER sees no document actions in History", () => {
        renderDrawer(StaffRoles.MANAGER);
        fireEvent.click(screen.getByTestId("discipline-tab-history"));

        expect(screen.queryByTestId("document-actions-11")).toBeNull();
        expect(screen.queryByText("Mark signed")).toBeNull();
    });

    it("renders no document actions when the action is not documentAvailable", () => {
        mockUseStaffDiscipline.mockReturnValue({
            record: makeRecord({ violations, actions: [{ ...action, documentAvailable: false }] }),
            loading: false, error: null, refresh: jest.fn<void, []>(),
        });
        renderDrawer(StaffRoles.OWNER);
        fireEvent.click(screen.getByTestId("discipline-tab-history"));

        expect(screen.queryByTestId("document-actions-11")).toBeNull();
    });

    it("on native, History keeps sign/refusal but has no download buttons", () => {
        mockIsNativePlatform = true;
        renderDrawer(StaffRoles.OWNER);
        fireEvent.click(screen.getByTestId("discipline-tab-history"));

        expect(screen.queryByText("Download document")).toBeNull();
        expect(screen.getByText("Mark signed")).toBeTruthy();
    });
});
