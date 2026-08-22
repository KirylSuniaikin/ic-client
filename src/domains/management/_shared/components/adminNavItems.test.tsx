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
            ].sort()
        );
        expect(labelsOf(sections)).not.toContain("Logout");
    });

    it("gives a null role the same set as MANAGER (regression: existing default branch)", () => {
        const sections = buildAdminNavSections(null, makeHandlers());

        expect(labelsOf(sections).sort()).toEqual(labelsOf(buildAdminNavSections(StaffRoles.MANAGER, makeHandlers())).sort());
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

    it("wires each item's onClick to the matching handler", () => {
        const handlers = makeHandlers();
        const sections = buildAdminNavSections(StaffRoles.MANAGER, handlers);
        const purchase = sections.flatMap(s => s.items).find(item => item.label === "Purchase");

        expect(purchase).toBeTruthy();
        purchase?.onClick();

        expect(handlers.onPurchaseOpen).toHaveBeenCalledTimes(1);
    });
});
