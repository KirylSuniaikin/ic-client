import { jest, describe, it, expect } from "@jest/globals";
import { buildAdminNavSections } from "./adminNavItems";
import type { AdminNavHandlers } from "./adminNavItems";
import { StaffRoles } from "../../../auth/types";

function makeHandlers(): AdminNavHandlers {
    return {
        onGoToMenu: jest.fn(),
        onShiftManagementPageOpen: jest.fn(),
        onOpenHistory: jest.fn(),
        onOpenConfig: jest.fn(),
        onOpenStatistics: jest.fn(),
        onManagementPageOpen: jest.fn(),
        onPurchaseOpen: jest.fn(),
        onCashRegisterOpen: jest.fn(),
        onAccountingOpen: jest.fn(),
        onBlacklistopen: jest.fn(),
        onAccountManagerOpen: jest.fn(),
        onSwitchSurface: jest.fn(),
        logout: jest.fn(),
    };
}

function labelsOf(sections: ReturnType<typeof buildAdminNavSections>): string[] {
    return sections.flatMap(section => section.items.map(item => item.label));
}

describe("buildAdminNavSections", () => {
    it("always returns the Operations / Money / Management sections, in that order", () => {
        const sections = buildAdminNavSections(StaffRoles.MANAGER, makeHandlers());

        expect(sections.map(s => s.title)).toEqual(["Operations", "Money", "Management"]);
    });

    it("gives a MANAGER the full manager item set, minus Logout (pinned separately)", () => {
        const sections = buildAdminNavSections(StaffRoles.MANAGER, makeHandlers());

        expect(labelsOf(sections).sort()).toEqual(
            [
                "New Order", "Shifts", "Order History", "Statistics", "Config",
                "Inventory", "Purchase", "Cash Register", "Accounting", "Blacklist",
                "Account Manager", "Task Board",
            ].sort()
        );
        expect(labelsOf(sections)).not.toContain("Logout");
    });

    // The board is the one item a null role does NOT inherit from the manager default: it is
    // gated on isManagerRole, which is also what AdminHomePage uses to decide whether the board
    // renders at all -- a row that switched to a surface that never appears would be a dead end.
    it("gives a null role the same set as MANAGER, minus the board toggle", () => {
        const sections = buildAdminNavSections(null, makeHandlers());
        const managerLabels = labelsOf(buildAdminNavSections(StaffRoles.MANAGER, makeHandlers()));

        expect(labelsOf(sections).sort()).toEqual(managerLabels.filter(l => l !== "Task Board").sort());
    });

    it("gives a COOK only the cook base items", () => {
        const sections = buildAdminNavSections(StaffRoles.COOK, makeHandlers());

        expect(labelsOf(sections).sort()).toEqual(
            ["New Order", "Shifts", "Order History", "Config", "Statistics"].sort()
        );
    });

    it("gives a SUPERVISOR the cook base items plus Cash Register only", () => {
        const sections = buildAdminNavSections(StaffRoles.SUPERVISOR, makeHandlers());

        expect(labelsOf(sections).sort()).toEqual(
            ["New Order", "Shifts", "Order History", "Config", "Statistics", "Cash Register"].sort()
        );
    });

    it("gives a REVIEWER only Order History", () => {
        const sections = buildAdminNavSections(StaffRoles.REVIEWER, makeHandlers());

        expect(labelsOf(sections)).toEqual(["Order History"]);
    });

    // Account Manager moved out of the top tab strip into this drawer. It belongs in Management
    // (not Operations) and must stay behind the same role gate the backend puts on /api/staff/**,
    // or a COOK gets a menu row that can only ever answer 403.
    it("puts Account Manager in the Management section for a MANAGER", () => {
        const sections = buildAdminNavSections(StaffRoles.MANAGER, makeHandlers());
        const management = sections.find(s => s.title === "Management");

        expect(management?.items.map(item => item.label)).toContain("Account Manager");
    });

    it("wires Account Manager to onAccountManagerOpen", () => {
        const handlers = makeHandlers();
        const sections = buildAdminNavSections(StaffRoles.OWNER, handlers);
        const item = sections.flatMap(s => s.items).find(i => i.label === "Account Manager");

        expect(item).toBeTruthy();
        item?.onClick();

        expect(handlers.onAccountManagerOpen).toHaveBeenCalledTimes(1);
    });

    it.each([StaffRoles.COOK, StaffRoles.SUPERVISOR, StaffRoles.REVIEWER])(
        "hides Account Manager from role %s",
        role => {
            const sections = buildAdminNavSections(role, makeHandlers());

            expect(labelsOf(sections)).not.toContain("Account Manager");
        }
    );

    // One row, not two: whichever surface you are NOT on is the one worth offering.
    describe("order desk / task board toggle", () => {
        it("offers Task Board while the order desk is showing", () => {
            const sections = buildAdminNavSections(StaffRoles.MANAGER, makeHandlers(), "orders");
            const operations = sections.find(s => s.title === "Operations");

            expect(operations?.items.map(i => i.label)).toContain("Task Board");
            expect(labelsOf(sections)).not.toContain("Order Board");
        });

        it("offers Order Board while the task board is showing", () => {
            const sections = buildAdminNavSections(StaffRoles.MANAGER, makeHandlers(), "board");
            const operations = sections.find(s => s.title === "Operations");

            expect(operations?.items.map(i => i.label)).toContain("Order Board");
            expect(labelsOf(sections)).not.toContain("Task Board");
        });

        it("defaults to the order desk when no tab is given", () => {
            expect(labelsOf(buildAdminNavSections(StaffRoles.OWNER, makeHandlers()))).toContain("Task Board");
        });

        it("wires the toggle to onSwitchSurface in both directions", () => {
            const handlers = makeHandlers();

            const fromDesk = buildAdminNavSections(StaffRoles.OWNER, handlers, "orders")
                .flatMap(s => s.items).find(i => i.label === "Task Board");
            fromDesk?.onClick();
            const fromBoard = buildAdminNavSections(StaffRoles.OWNER, handlers, "board")
                .flatMap(s => s.items).find(i => i.label === "Order Board");
            fromBoard?.onClick();

            expect(handlers.onSwitchSurface).toHaveBeenCalledTimes(2);
        });

        it.each([StaffRoles.COOK, StaffRoles.SUPERVISOR, StaffRoles.REVIEWER])(
            "offers no board toggle to role %s, in either direction",
            role => {
                for (const tab of ["orders", "board"] as const) {
                    const labels = labelsOf(buildAdminNavSections(role, makeHandlers(), tab));

                    expect(labels).not.toContain("Task Board");
                    expect(labels).not.toContain("Order Board");
                }
            }
        );
    });

    it("wires each item's onClick to the matching handler", () => {
        const handlers = makeHandlers();
        const sections = buildAdminNavSections(StaffRoles.MANAGER, handlers);
        const purchase = sections.flatMap(s => s.items).find(item => item.label === "Purchase");

        expect(purchase).toBeTruthy();
        purchase?.onClick();

        expect(handlers.onPurchaseOpen).toHaveBeenCalledTimes(1);
    });
});
