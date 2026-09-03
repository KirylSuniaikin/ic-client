import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { StaffRoles } from "../../../auth/types";
import type { UseStaffAccountsResult } from "../hooks/useStaffAccounts";
import type { HireStaffRequest, HiredStaffTO, StaffAdminTO, UpdateStaffDetailsRequest, UpdateStaffPayrollRequest } from "../types";

// The staff auth context decodes a JWT out of storage on mount; the screen reads `userId`
// (for the self-guard on the row actions), so stub the hook rather than standing up a real
// provider (same pattern as AccountingReportPopup.test.tsx).
const mockUseAuth = jest.fn<{ branchId: string | null; userId: number | null }, []>();
jest.mock("../../../auth/context/AuthProvider", () => ({
    useAuth: () => mockUseAuth(),
}));

// Isolates AccountManagerScreen's own composition (list rendering, OWNER-only price column,
// Hire button wiring) from the hook's own internals, which have their own useStaffAccounts.test.ts.
jest.mock("../hooks/useStaffAccounts");

// useBranchScope reads this context; canSwitch is branches.length > 1, so the fixture decides
// whether a selector renders. Mirrors HireStaffDrawer.test.tsx's stub.
type Branch = { id: string; externalId: string; branchNo: number; branchName: string; locale: string };
const homeBranch: Branch = { id: "branch-1", externalId: "b1", branchNo: 1, branchName: "Main", locale: "BH" };
const secondBranch: Branch = { id: "branch-2", externalId: "b2", branchNo: 2, branchName: "Seef", locale: "BH" };
const mockUseManagementBranchScope = jest.fn<{ branches: Branch[]; homeBranch: Branch | null }, []>();
jest.mock("../../_shared/context/ManagementBranchScope", () => ({
    useManagementBranchScope: () => mockUseManagementBranchScope(),
}));

// HireStaffDrawer has its own dedicated test file — stub it here so this file only asserts
// that AccountManagerScreen opens/closes it and wires `create` through.
function mockHireStaffDrawer({ open }: { open: boolean; onClose: () => void; create: unknown }): JSX.Element {
    return <div data-testid="hire-staff-drawer-stub" data-open={open ? "true" : "false"} />;
}
jest.mock("./HireStaffDrawer", () => ({
    __esModule: true,
    default: mockHireStaffDrawer,
}));

// Both have their own test files; here they only need to report whether the screen opened them.
function mockResetPasswordDrawer({ open, target }: { open: boolean; target: StaffAdminTO | null; onClose: () => void; resetPassword: unknown }): JSX.Element {
    return <div data-testid="reset-password-drawer-stub" data-open={open ? "true" : "false"} data-target={target ? String(target.id) : ""} />;
}
jest.mock("./ResetPasswordDrawer", () => ({
    __esModule: true,
    default: mockResetPasswordDrawer,
}));

// Has its own dedicated test file -- here it only needs to report whether the screen opened it
// for the clicked row, mirroring the ResetPasswordDrawer/HireStaffDrawer stubs above.
function mockEditStaffDrawer({ open, target }: { open: boolean; target: StaffAdminTO | null; callerRole: unknown; onClose: () => void; updateDetails: unknown; changeBranch: unknown; updatePayroll: unknown; setEnabled: unknown }): JSX.Element {
    return <div data-testid="edit-staff-drawer-stub" data-open={open ? "true" : "false"} data-target={target ? String(target.id) : ""} />;
}
jest.mock("./EditStaffDrawer", () => ({
    __esModule: true,
    default: mockEditStaffDrawer,
}));

import { useStaffAccounts } from "../hooks/useStaffAccounts";
import AccountManagerScreen from "./AccountManagerScreen";

const mockUseStaffAccounts = jest.mocked(useStaffAccounts);

function makeStaff(overrides: Partial<StaffAdminTO> = {}): StaffAdminTO {
    return {
        id: 1,
        username: "casey.cook",
        fullName: "Casey Cook",
        role: StaffRoles.COOK,
        branchId: "branch-1",
        pricePerHour: null,
        enabled: true,
        cprNumber: null,
        basicSalary: null,
        housingAllowance: null,
        transportAllowance: null,
        ...overrides,
    };
}

function staffAccountsValue(overrides: Partial<UseStaffAccountsResult> = {}): UseStaffAccountsResult {
    return {
        staff: [],
        loading: false,
        error: null,
        create: jest.fn<Promise<HiredStaffTO>, [HireStaffRequest]>(),
        resetPassword: jest.fn<Promise<void>, [number, string]>(),
        setEnabled: jest.fn<Promise<StaffAdminTO>, [number, boolean]>(),
        changeBranch: jest.fn<Promise<StaffAdminTO>, [number, string]>(),
        updatePayroll: jest.fn<Promise<StaffAdminTO>, [number, UpdateStaffPayrollRequest]>(),
        updateDetails: jest.fn<Promise<StaffAdminTO>, [number, UpdateStaffDetailsRequest]>(),
        refresh: jest.fn<void, []>(),
        ...overrides,
    };
}

describe("AccountManagerScreen", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUseAuth.mockReturnValue({ branchId: "branch-1", userId: 99 });
        mockUseManagementBranchScope.mockReturnValue({ branches: [homeBranch], homeBranch });
        mockUseStaffAccounts.mockReturnValue(staffAccountsValue());
    });

    it("renders fullName with username fallback for staff whose fullName is null", () => {
        mockUseStaffAccounts.mockReturnValue(staffAccountsValue({
            staff: [
                makeStaff({ id: 1, fullName: "Casey Cook", username: "casey.cook" }),
                makeStaff({ id: 2, fullName: null, username: "no.name.yet" }),
            ],
        }));

        render(<AccountManagerScreen open role={StaffRoles.MANAGER} branch={homeBranch} onClose={jest.fn()} />);

        expect(within(screen.getByTestId("staff-row-1")).getByText("Casey Cook")).toBeTruthy();
        // Row 2 has no fullName -- both the Name and Login cells fall back to the username,
        // so "no.name.yet" legitimately appears twice within that one row.
        expect(within(screen.getByTestId("staff-row-2")).getAllByText("no.name.yet")).toHaveLength(2);
    });

    it("omits the price/hour column for a non-OWNER viewer", () => {
        mockUseStaffAccounts.mockReturnValue(staffAccountsValue({ staff: [makeStaff({ pricePerHour: 5 })] }));

        render(<AccountManagerScreen open role={StaffRoles.MANAGER} branch={homeBranch} onClose={jest.fn()} />);

        expect(screen.queryByText("Price/hour")).toBeNull();
    });

    it("shows the price/hour column for an OWNER viewer, blank when pricePerHour is null", () => {
        mockUseStaffAccounts.mockReturnValue(staffAccountsValue({
            staff: [makeStaff({ id: 1, pricePerHour: null })],
        }));

        render(<AccountManagerScreen open role={StaffRoles.OWNER} branch={homeBranch} onClose={jest.fn()} />);

        expect(screen.getByText("Price/hour")).toBeTruthy();
    });

    // Replaces the old "a city role fetches every branch at once" behaviour: the roster is now
    // always one branch, and a city-level caller switches between them.
    it("scopes the fetch to the branch in scope", () => {
        mockUseManagementBranchScope.mockReturnValue({ branches: [homeBranch], homeBranch });

        render(<AccountManagerScreen open role={StaffRoles.OWNER} branch={homeBranch} onClose={jest.fn()} />);

        expect(mockUseStaffAccounts).toHaveBeenCalledWith("branch-1");
    });

    it("offers no branch selector when only one branch is in scope", () => {
        mockUseManagementBranchScope.mockReturnValue({ branches: [homeBranch], homeBranch });

        render(<AccountManagerScreen open role={StaffRoles.MANAGER} branch={homeBranch} onClose={jest.fn()} />);

        expect(screen.queryByTestId("staff-filter-branch")).toBeNull();
    });

    it("offers a branch selector when more than one branch is in scope", () => {
        mockUseManagementBranchScope.mockReturnValue({ branches: [homeBranch, secondBranch], homeBranch });

        render(<AccountManagerScreen open role={StaffRoles.OWNER} branch={homeBranch} onClose={jest.fn()} />);

        expect(screen.getByTestId("staff-filter-branch")).toBeTruthy();
    });

    it("opens the HireStaffDrawer when the Hire button is clicked", () => {
        render(<AccountManagerScreen open role={StaffRoles.MANAGER} branch={homeBranch} onClose={jest.fn()} />);

        expect(screen.getByTestId("hire-staff-drawer-stub").getAttribute("data-open")).toBe("false");

        fireEvent.click(screen.getByTestId("staff-hire-button"));

        expect(screen.getByTestId("hire-staff-drawer-stub").getAttribute("data-open")).toBe("true");
    });

    it("surfaces a hook error via the ErrorSnackbar", () => {
        mockUseStaffAccounts.mockReturnValue(staffAccountsValue({ error: "HTTP 500" }));

        render(<AccountManagerScreen open role={StaffRoles.MANAGER} branch={homeBranch} onClose={jest.fn()} />);

        expect(screen.getByText("HTTP 500")).toBeTruthy();
    });

    it("hides deactivated accounts by default and reveals them under All", () => {
        mockUseStaffAccounts.mockReturnValue(staffAccountsValue({
            staff: [makeStaff({ id: 1 }), makeStaff({ id: 2, username: "gone", enabled: false })],
        }));

        render(<AccountManagerScreen open role={StaffRoles.MANAGER} branch={homeBranch} onClose={jest.fn()} />);

        expect(screen.getByTestId("staff-row-1")).toBeTruthy();
        expect(screen.queryByTestId("staff-row-2")).toBeNull();

        fireEvent.click(screen.getByTestId("staff-filter-all"));

        expect(screen.getByTestId("staff-row-2")).toBeTruthy();
        expect(screen.getByTestId("staff-deactivated-chip-2")).toBeTruthy();
    });

    it("offers no actions on the caller's own row", () => {
        mockUseAuth.mockReturnValue({ branchId: "branch-1", userId: 1 });
        mockUseStaffAccounts.mockReturnValue(staffAccountsValue({
            staff: [makeStaff({ id: 1, role: StaffRoles.COOK })],
        }));

        render(<AccountManagerScreen open role={StaffRoles.MANAGER} branch={homeBranch} onClose={jest.fn()} />);

        expect(screen.queryByTestId("staff-reset-1")).toBeNull();
        expect(screen.queryByTestId("staff-edit-1")).toBeNull();
    });

    it("offers no actions on a peer the caller may not administer", () => {
        mockUseStaffAccounts.mockReturnValue(staffAccountsValue({
            staff: [makeStaff({ id: 3, role: StaffRoles.MANAGER })],
        }));

        render(<AccountManagerScreen open role={StaffRoles.MANAGER} branch={homeBranch} onClose={jest.fn()} />);

        expect(screen.queryByTestId("staff-reset-3")).toBeNull();
        expect(screen.queryByTestId("staff-edit-3")).toBeNull();
    });

    // Reset password stays exactly as it was before the consolidation -- its own icon, its own
    // drawer -- so this proves the change to the other three buttons did not touch it.
    it("opens the reset drawer for the chosen row", () => {
        mockUseStaffAccounts.mockReturnValue(staffAccountsValue({ staff: [makeStaff({ id: 4 })] }));

        render(<AccountManagerScreen open role={StaffRoles.MANAGER} branch={homeBranch} onClose={jest.fn()} />);

        expect(screen.getByTestId("reset-password-drawer-stub").getAttribute("data-open")).toBe("false");

        fireEvent.click(screen.getByTestId("staff-reset-4"));

        const stub = screen.getByTestId("reset-password-drawer-stub");
        expect(stub.getAttribute("data-open")).toBe("true");
        expect(stub.getAttribute("data-target")).toBe("4");
    });

    // Change branch, Edit payroll and Deactivate/Reactivate were consolidated into one Edit
    // button opening EditStaffDrawer -- their old per-row icons must no longer render.
    it("no longer renders the old change-branch, edit-payroll or deactivate/reactivate buttons", () => {
        mockUseStaffAccounts.mockReturnValue(staffAccountsValue({
            staff: [makeStaff({ id: 5 }), makeStaff({ id: 6, enabled: false })],
        }));

        render(<AccountManagerScreen open role={StaffRoles.OWNER} branch={homeBranch} onClose={jest.fn()} />);
        fireEvent.click(screen.getByTestId("staff-filter-all"));

        expect(screen.queryByTestId("staff-change-branch-5")).toBeNull();
        expect(screen.queryByTestId("staff-edit-payroll-5")).toBeNull();
        expect(screen.queryByTestId("staff-deactivate-5")).toBeNull();
        expect(screen.queryByTestId("staff-reactivate-6")).toBeNull();
    });

    it("opens EditStaffDrawer with the clicked row as target, for any administrable row", () => {
        mockUseStaffAccounts.mockReturnValue(staffAccountsValue({ staff: [makeStaff({ id: 8 })] }));

        render(<AccountManagerScreen open role={StaffRoles.MANAGER} branch={homeBranch} onClose={jest.fn()} />);

        expect(screen.getByTestId("edit-staff-drawer-stub").getAttribute("data-open")).toBe("false");

        fireEvent.click(screen.getByTestId("staff-edit-8"));

        const stub = screen.getByTestId("edit-staff-drawer-stub");
        expect(stub.getAttribute("data-open")).toBe("true");
        expect(stub.getAttribute("data-target")).toBe("8");
    });

    it("offers the Edit action to a non-OWNER viewer too -- payroll/price gating now lives inside the drawer", () => {
        mockUseStaffAccounts.mockReturnValue(staffAccountsValue({ staff: [makeStaff({ id: 11 })] }));

        render(<AccountManagerScreen open role={StaffRoles.MANAGER} branch={homeBranch} onClose={jest.fn()} />);

        expect(screen.getByTestId("staff-edit-11")).toBeTruthy();
    });

    // It stopped being a tab and became a full-screen surface opened from the nav drawer's
    // Management section, so `open` and a way back out are now part of its contract.
    describe("full-screen presentation", () => {
        it("renders nothing while closed", () => {
            mockUseStaffAccounts.mockReturnValue(staffAccountsValue({ staff: [makeStaff({ id: 1 })] }));

            render(<AccountManagerScreen open={false} role={StaffRoles.MANAGER} branch={homeBranch} onClose={jest.fn()} />);

            expect(screen.queryByTestId("staff-row-1")).toBeNull();
        });

        it("calls onClose from the top bar's back arrow", () => {
            const onClose = jest.fn();
            mockUseStaffAccounts.mockReturnValue(staffAccountsValue({ staff: [makeStaff({ id: 1 })] }));

            render(<AccountManagerScreen open role={StaffRoles.MANAGER} branch={homeBranch} onClose={onClose} />);

            fireEvent.click(screen.getByLabelText("back"));

            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it("shows an empty state instead of a bare table when the branch has nobody active", () => {
            mockUseStaffAccounts.mockReturnValue(staffAccountsValue({ staff: [] }));

            render(<AccountManagerScreen open role={StaffRoles.MANAGER} branch={homeBranch} onClose={jest.fn()} />);

            expect(screen.getByTestId("staff-empty-state")).toBeTruthy();
        });
    });

    describe("role filter", () => {
        it("offers only the roles actually present on this branch", () => {
            mockUseStaffAccounts.mockReturnValue(staffAccountsValue({
                staff: [
                    makeStaff({ id: 1, role: StaffRoles.COOK }),
                    makeStaff({ id: 2, role: StaffRoles.COOK }),
                    makeStaff({ id: 3, role: StaffRoles.REVIEWER }),
                ],
            }));

            render(<AccountManagerScreen open role={StaffRoles.MANAGER} branch={homeBranch} onClose={jest.fn()} />);
            fireEvent.mouseDown(within(screen.getByTestId("staff-filter-role")).getByRole("combobox"));

            expect(screen.getByRole("option", { name: "Cook" })).toBeTruthy();
            expect(screen.getByRole("option", { name: "Reviewer" })).toBeTruthy();
            expect(screen.queryByRole("option", { name: "Manager" })).toBeNull();
        });

        it("narrows the roster to the chosen role", () => {
            mockUseStaffAccounts.mockReturnValue(staffAccountsValue({
                staff: [
                    makeStaff({ id: 1, role: StaffRoles.COOK }),
                    makeStaff({ id: 2, role: StaffRoles.REVIEWER }),
                ],
            }));

            render(<AccountManagerScreen open role={StaffRoles.MANAGER} branch={homeBranch} onClose={jest.fn()} />);
            fireEvent.mouseDown(within(screen.getByTestId("staff-filter-role")).getByRole("combobox"));
            fireEvent.click(screen.getByRole("option", { name: "Reviewer" }));

            expect(screen.queryByTestId("staff-row-1")).toBeNull();
            expect(screen.getByTestId("staff-row-2")).toBeTruthy();
        });

        // The two filters are independent: a deactivated cook must stay hidden under Active even
        // when the role filter selects cooks.
        it("combines with the active/all filter rather than replacing it", () => {
            mockUseStaffAccounts.mockReturnValue(staffAccountsValue({
                staff: [
                    makeStaff({ id: 1, role: StaffRoles.COOK, enabled: true }),
                    makeStaff({ id: 2, role: StaffRoles.COOK, enabled: false }),
                ],
            }));

            render(<AccountManagerScreen open role={StaffRoles.MANAGER} branch={homeBranch} onClose={jest.fn()} />);
            fireEvent.mouseDown(within(screen.getByTestId("staff-filter-role")).getByRole("combobox"));
            fireEvent.click(screen.getByRole("option", { name: "Cook" }));

            expect(screen.getByTestId("staff-row-1")).toBeTruthy();
            expect(screen.queryByTestId("staff-row-2")).toBeNull();

            fireEvent.click(screen.getByTestId("staff-filter-all"));

            expect(screen.getByTestId("staff-row-2")).toBeTruthy();
        });
    });
});
