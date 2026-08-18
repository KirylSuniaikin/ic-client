import { jest, describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import AdminTopbar from "./AdminTopbar";
import { StaffRoles } from "../../../auth/types";
import type { IBranch } from "../../inventory/types";

// AdminTopbar calls updateWorkload (public.ts) from its own Workload <Select>; mocked so no
// unhandled network call happens if a test interacts with it (none of the tests below do).
jest.mock("../../../../shared/api/public");

const selectedBranch: IBranch = { id: "1", externalId: "ext-1", branchNo: 1, branchName: "Test Branch", locale: "en" };

const MANAGER_ONLY_LABELS = [
    "New Order",
    "Shifts",
    "Statistics",
    "Config",
    "Inventory",
    "Purchase",
    "Cash Register",
    "Accounting",
    "Blacklist",
];

const SHARED_LABELS = ["Order History", "Logout"];

function renderTopbar(role: StaffRoles | null): void {
    render(
        <AdminTopbar
            onOpenHistory={jest.fn()}
            onOpenStatistics={jest.fn()}
            onOpenConfig={jest.fn()}
            onGoToMenu={jest.fn()}
            branchId="1"
            workloadLevel="IDLE"
            onWorkloadChange={jest.fn()}
            adminId={1}
            onPurchaseOpen={jest.fn()}
            onManagementPageOpen={jest.fn()}
            cashStage="OPEN_SHIFT_CASH_CHECK"
            onShiftManagementPageOpen={jest.fn()}
            shiftStage="OPEN_SHIFT_EVENT"
            onCashClick={jest.fn()}
            onShiftStageClick={jest.fn()}
            branches={[selectedBranch]}
            onBranchChange={jest.fn()}
            selectedBranch={selectedBranch}
            onBlacklistopen={jest.fn()}
            onCashRegisterOpen={jest.fn()}
            onAccountingOpen={jest.fn()}
            role={role}
            logout={jest.fn()}
            userName="Test User"
        />
    );
}

function openMenu(): void {
    const icon = screen.getByTestId("MoreHorizIcon");
    const button = icon.closest("button");
    if (!button) throw new Error("MoreHorizIcon is not inside a button");
    fireEvent.click(button);
}

describe("AdminTopbar — role-based branch controls", () => {
    it("hides the Workload selector and the Cash/Shift buttons for role REVIEWER", () => {
        renderTopbar(StaffRoles.REVIEWER);

        expect(screen.queryByRole("combobox")).toBeNull();
        expect(screen.queryByText("Open Cash")).toBeNull();
        expect(screen.queryByText("Open Shift")).toBeNull();
    });

    it("still renders the Workload selector and the Cash/Shift buttons for role MANAGER (regression)", () => {
        renderTopbar(StaffRoles.MANAGER);

        expect(screen.getByRole("combobox")).toBeTruthy();
        expect(screen.getByText("Open Cash")).toBeTruthy();
        expect(screen.getByText("Open Shift")).toBeTruthy();
    });

    it("still renders the Workload selector and the Cash/Shift buttons for role COOK (regression)", () => {
        renderTopbar(StaffRoles.COOK);

        expect(screen.getByRole("combobox")).toBeTruthy();
        expect(screen.getByText("Open Cash")).toBeTruthy();
        expect(screen.getByText("Open Shift")).toBeTruthy();
    });

    it("still renders the Workload selector and the Cash/Shift buttons for role SUPERVISOR", () => {
        renderTopbar(StaffRoles.SUPERVISOR);

        expect(screen.getByRole("combobox")).toBeTruthy();
        expect(screen.getByText("Open Cash")).toBeTruthy();
        expect(screen.getByText("Open Shift")).toBeTruthy();
    });
});

describe("AdminTopbar — role-based branch selector", () => {
    // MUI's outlined Select doesn't wire an htmlFor/aria-labelledby that
    // testing-library's label-association algorithm can follow, so target the
    // InputLabel element itself rather than getByLabelText.
    const branchSelectorLabel = () => screen.queryByText("Branch", { selector: "label" });

    it("hides the branch selector for role MANAGER", () => {
        renderTopbar(StaffRoles.MANAGER);

        expect(branchSelectorLabel()).toBeNull();
    });

    it("shows the branch selector for role SUPER_MANAGER (city-wide access)", () => {
        renderTopbar(StaffRoles.SUPER_MANAGER);

        expect(branchSelectorLabel()).toBeTruthy();
    });

    it("shows the branch selector for role OWNER (city-wide access parity with SUPER_MANAGER)", () => {
        renderTopbar(StaffRoles.OWNER);

        expect(branchSelectorLabel()).toBeTruthy();
    });
});

describe("AdminTopbar — role-based menu items", () => {
    it("renders exactly Order History and Logout for role REVIEWER", () => {
        renderTopbar(StaffRoles.REVIEWER);
        openMenu();

        SHARED_LABELS.forEach(label => {
            expect(screen.getByText(label)).toBeTruthy();
        });

        MANAGER_ONLY_LABELS.forEach(label => {
            expect(screen.queryByText(label)).toBeNull();
        });
    });

    it("renders the existing manager item list for role MANAGER (regression)", () => {
        renderTopbar(StaffRoles.MANAGER);
        openMenu();

        [...SHARED_LABELS, ...MANAGER_ONLY_LABELS].forEach(label => {
            expect(screen.getByText(label)).toBeTruthy();
        });
    });

    it("renders the existing manager item list for role SUPER_MANAGER (regression)", () => {
        renderTopbar(StaffRoles.SUPER_MANAGER);
        openMenu();

        [...SHARED_LABELS, ...MANAGER_ONLY_LABELS].forEach(label => {
            expect(screen.getByText(label)).toBeTruthy();
        });
    });

    it("renders the existing manager item list for role OWNER", () => {
        renderTopbar(StaffRoles.OWNER);
        openMenu();

        [...SHARED_LABELS, ...MANAGER_ONLY_LABELS].forEach(label => {
            expect(screen.getByText(label)).toBeTruthy();
        });
    });

    it("renders the existing manager item list for a null role (regression)", () => {
        renderTopbar(null);
        openMenu();

        [...SHARED_LABELS, ...MANAGER_ONLY_LABELS].forEach(label => {
            expect(screen.getByText(label)).toBeTruthy();
        });
    });

    it("renders the existing cook item list for role COOK (regression)", () => {
        renderTopbar(StaffRoles.COOK);
        openMenu();

        // Cook items: New Order, Shifts, Order History, Config, Statistics, Logout —
        // notably Inventory/Purchase/Cash Register/Accounting/Blacklist are cook-excluded too.
        ["New Order", "Shifts", "Order History", "Config", "Statistics", "Logout"].forEach(label => {
            expect(screen.getByText(label)).toBeTruthy();
        });

        ["Inventory", "Purchase", "Cash Register", "Accounting", "Blacklist"].forEach(label => {
            expect(screen.queryByText(label)).toBeNull();
        });
    });

    it("renders the cook item list plus Cash Register for role SUPERVISOR, with Logout last", () => {
        renderTopbar(StaffRoles.SUPERVISOR);
        openMenu();

        // SUPERVISOR = COOK base items + Cash Register + Logout.
        ["New Order", "Shifts", "Order History", "Config", "Statistics", "Cash Register", "Logout"].forEach(label => {
            expect(screen.getByText(label)).toBeTruthy();
        });

        // No manager-only entries besides the one it's explicitly granted (Cash Register).
        ["Inventory", "Purchase", "Accounting", "Blacklist"].forEach(label => {
            expect(screen.queryByText(label)).toBeNull();
        });

        // Logout is always the last entry in every role's menu.
        const cashRegister = screen.getByText("Cash Register");
        const logout = screen.getByText("Logout");
        expect(
            cashRegister.compareDocumentPosition(logout) & Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
    });

    it("does not render Cash Register for role COOK (regression: COOK menu is unchanged)", () => {
        renderTopbar(StaffRoles.COOK);
        openMenu();

        expect(screen.queryByText("Cash Register")).toBeNull();
    });
});
