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

function renderTopbar(role: StaffRoles | null, activeTab: "orders" | "board" = "orders"): void {
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
            onAccountManagerOpen={jest.fn()}
            activeTab={activeTab}
            onSwitchSurface={jest.fn()}
            role={role}
            logout={jest.fn()}
            userName="Test User"
        />
    );
}

function openMenu(): void {
    const icon = screen.getByTestId("MenuIcon");
    const button = icon.closest("button");
    if (!button) throw new Error("MenuIcon is not inside a button");
    fireEvent.click(button);
}

describe("AdminTopbar — role-based branch controls", () => {
    it("hides the Workload selector for role REVIEWER", () => {
        renderTopbar(StaffRoles.REVIEWER);

        expect(screen.queryByRole("combobox")).toBeNull();
    });

    it.each([StaffRoles.MANAGER, StaffRoles.COOK, StaffRoles.SUPERVISOR])(
        "still renders the Workload selector for role %s (regression)",
        role => {
            renderTopbar(role);

            expect(screen.getByRole("combobox")).toBeTruthy();
        }
    );

    // Cash and Shift are reachable from the nav drawer, which is where they now live for every
    // screen size. Duplicating them on the bar cost the width that the signed-in identity needs,
    // and only ever appeared from `sm` up, so a phone already had to use the drawer.
    describe("Cash and Shift are no longer duplicated on the bar", () => {
        it.each([StaffRoles.MANAGER, StaffRoles.COOK, StaffRoles.SUPERVISOR, StaffRoles.OWNER])(
            "renders no Cash/Shift button on the bar for role %s",
            role => {
                renderTopbar(role);

                expect(screen.queryByText("Open Cash")).toBeNull();
                expect(screen.queryByText("Open Shift")).toBeNull();
            }
        );

        it("still offers them inside the nav drawer", () => {
            renderTopbar(StaffRoles.MANAGER);
            openMenu();

            expect(screen.getByText("Open Cash")).toBeTruthy();
            expect(screen.getByText("Open Shift")).toBeTruthy();
        });
    });

    // The task board has neither orders to dial a workload for nor a branch to scope.
    describe("on the task board", () => {
        it("hides the Workload selector", () => {
            renderTopbar(StaffRoles.MANAGER, "board");

            expect(screen.queryByText("Workload", { selector: "label" })).toBeNull();
        });

        it("hides the branch selector from a city-level role", () => {
            renderTopbar(StaffRoles.OWNER, "board");

            expect(screen.queryByText("Branch", { selector: "label" })).toBeNull();
        });

        // A city-level role on the order desk renders two comboboxes, so target the labels.
        it("keeps showing both on the order desk", () => {
            renderTopbar(StaffRoles.OWNER, "orders");

            expect(screen.getByText("Workload", { selector: "label" })).toBeTruthy();
            expect(screen.getByText("Branch", { selector: "label" })).toBeTruthy();
        });
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

    // Regression for the bug Task 5 fixes: the old Popover's overflow:hidden clamped a
    // MANAGER's ~14-row menu on small screens, so Logout (the last row) was unreachable.
    // The nav drawer scrolls instead of clipping, so Logout must always be present in the DOM.
    it("renders Logout, reachable, for a MANAGER's full-length menu (regression: was clipped by the old Popover)", () => {
        renderTopbar(StaffRoles.MANAGER);
        openMenu();

        expect(screen.getByText("Logout")).toBeTruthy();
    });

    it("opens a Drawer, not a Popover, when the … button is clicked (regression: Popover removed)", () => {
        renderTopbar(StaffRoles.MANAGER);
        openMenu();

        expect(document.querySelector(".MuiPopover-root")).toBeNull();
        expect(document.querySelector(".MuiDrawer-root")).not.toBeNull();
    });

    // The signed-in identity lived in the old overflow dropdown's trigger and disappeared when
    // that became a nav drawer -- readable only after opening it. This asserts it is on the bar
    // itself, without any interaction.
    describe("signed-in identity", () => {
        it("shows the user's name on the bar without opening the drawer", () => {
            renderTopbar(StaffRoles.MANAGER);

            expect(screen.getByTestId("admin-topbar-user").textContent).toBe("Test User");
        });

        it("shows the role underneath it", () => {
            renderTopbar(StaffRoles.SUPER_MANAGER);

            expect(screen.getByText("super manager")).toBeTruthy();
        });

        it("still shows the name when the role is unknown", () => {
            renderTopbar(null);

            expect(screen.getByTestId("admin-topbar-user").textContent).toBe("Test User");
        });
    });
});
