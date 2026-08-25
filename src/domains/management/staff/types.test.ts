import { describe, it, expect } from "@jest/globals";
import { StaffRoles } from "../../auth/types";
import { canAdministerStaff, getHireableRoles } from "./types";
import type { StaffAdminTO } from "./types";

function staff(overrides: Partial<StaffAdminTO> = {}): StaffAdminTO {
    return {
        id: 2,
        username: "casey.cook",
        fullName: "Casey Cook",
        role: StaffRoles.COOK,
        branchId: "branch-1",
        pricePerHour: null,
        enabled: true,
        ...overrides,
    };
}

// This mirrors StaffService.resolveAdministrableTarget and only decides whether a row renders its
// actions -- the backend is the enforcement boundary. Both sides must agree, or a manager either
// sees a button that 403s or loses one they are entitled to.
describe("canAdministerStaff", () => {
    describe("hierarchy", () => {
        it.each([StaffRoles.COOK, StaffRoles.SUPERVISOR, StaffRoles.REVIEWER])(
            "lets a MANAGER administer a %s",
            role => {
                expect(canAdministerStaff(StaffRoles.MANAGER, 1, staff({ role }))).toBe(true);
            }
        );

        it("does not let a MANAGER administer a peer MANAGER", () => {
            expect(canAdministerStaff(StaffRoles.MANAGER, 1, staff({ role: StaffRoles.MANAGER }))).toBe(false);
        });

        it("lets a SUPER_MANAGER administer a MANAGER but not a peer", () => {
            expect(canAdministerStaff(StaffRoles.SUPER_MANAGER, 1, staff({ role: StaffRoles.MANAGER }))).toBe(true);
            expect(canAdministerStaff(StaffRoles.SUPER_MANAGER, 1, staff({ role: StaffRoles.SUPER_MANAGER }))).toBe(false);
        });

        // Owners are peers of each other by design: at that level the hierarchy has nobody above
        // to appeal to, so an owner locked out could not be helped by anyone else.
        it("lets an OWNER administer another OWNER", () => {
            expect(canAdministerStaff(StaffRoles.OWNER, 1, staff({ id: 2, role: StaffRoles.OWNER }))).toBe(true);
        });

        it.each([StaffRoles.COOK, StaffRoles.SUPERVISOR, StaffRoles.REVIEWER, null])(
            "gives role %s no one to administer",
            role => {
                expect(canAdministerStaff(role, 1, staff())).toBe(false);
            }
        );
    });

    // Even an owner cannot reset or deactivate themselves: it is the one action with no way back,
    // since nothing in the app could re-enable the account afterwards.
    describe("self guard", () => {
        it("refuses the caller's own row, whatever the role", () => {
            expect(canAdministerStaff(StaffRoles.OWNER, 7, staff({ id: 7, role: StaffRoles.OWNER }))).toBe(false);
            expect(canAdministerStaff(StaffRoles.MANAGER, 7, staff({ id: 7, role: StaffRoles.MANAGER }))).toBe(false);
        });

        it("still allows an identical role on a different id", () => {
            expect(canAdministerStaff(StaffRoles.OWNER, 7, staff({ id: 8, role: StaffRoles.OWNER }))).toBe(true);
        });
    });
});

describe("getHireableRoles", () => {
    it("offers a MANAGER only the roles below them", () => {
        expect(getHireableRoles(StaffRoles.MANAGER)).toEqual([
            StaffRoles.COOK, StaffRoles.SUPERVISOR, StaffRoles.REVIEWER,
        ]);
    });

    it("offers an OWNER every role, their own included", () => {
        expect(getHireableRoles(StaffRoles.OWNER)).toContain(StaffRoles.OWNER);
    });

    it("offers nothing for a null role", () => {
        expect(getHireableRoles(null)).toEqual([]);
    });
});
