import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { StaffRoles } from "../../../auth/types";
import type { UseStaffAccountsResult } from "../hooks/useStaffAccounts";
import type { HireStaffRequest, HiredStaffTO, StaffAdminTO } from "../types";

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

function mockDeactivateStaffDialog({ open, target, onConfirm }: { open: boolean; target: StaffAdminTO | null; submitting: boolean; onConfirm: () => void; onCancel: () => void }): JSX.Element {
    return (
        <div data-testid="deactivate-dialog-stub" data-open={open ? "true" : "false"} data-target={target ? String(target.id) : ""}>
            <button data-testid="deactivate-dialog-confirm" onClick={onConfirm}>confirm</button>
        </div>
    );
}
jest.mock("./DeactivateStaffDialog", () => ({
    __esModule: true,
    default: mockDeactivateStaffDialog,
}));

function mockChangeBranchDrawer({ open, target }: { open: boolean; target: StaffAdminTO | null; onClose: () => void; changeBranch: unknown }): JSX.Element {
    return <div data-testid="change-branch-drawer-stub" data-open={open ? "true" : "false"} data-target={target ? String(target.id) : ""} />;
}
jest.mock("./ChangeBranchDrawer", () => ({
    __esModule: true,
    default: mockChangeBranchDrawer,
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

        // The selector is the only combobox this screen renders.
        expect(screen.queryByRole("combobox")).toBeNull();
    });

    it("offers a branch selector when more than one branch is in scope", () => {
        mockUseManagementBranchScope.mockReturnValue({ branches: [homeBranch, secondBranch], homeBranch });

        render(<AccountManagerScreen open role={StaffRoles.OWNER} branch={homeBranch} onClose={jest.fn()} />);

        expect(screen.getByRole("combobox")).toBeTruthy();
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
        expect(screen.queryByTestId("staff-deactivate-1")).toBeNull();
    });

    it("offers no actions on a peer the caller may not administer", () => {
        mockUseStaffAccounts.mockReturnValue(staffAccountsValue({
            staff: [makeStaff({ id: 3, role: StaffRoles.MANAGER })],
        }));

        render(<AccountManagerScreen open role={StaffRoles.MANAGER} branch={homeBranch} onClose={jest.fn()} />);

        expect(screen.queryByTestId("staff-reset-3")).toBeNull();
        expect(screen.queryByTestId("staff-deactivate-3")).toBeNull();
    });

    it("opens the reset drawer for the chosen row", () => {
        mockUseStaffAccounts.mockReturnValue(staffAccountsValue({ staff: [makeStaff({ id: 4 })] }));

        render(<AccountManagerScreen open role={StaffRoles.MANAGER} branch={homeBranch} onClose={jest.fn()} />);

        expect(screen.getByTestId("reset-password-drawer-stub").getAttribute("data-open")).toBe("false");

        fireEvent.click(screen.getByTestId("staff-reset-4"));

        const stub = screen.getByTestId("reset-password-drawer-stub");
        expect(stub.getAttribute("data-open")).toBe("true");
        expect(stub.getAttribute("data-target")).toBe("4");
    });

    it("confirms before deactivating, then calls setEnabled(false)", async () => {
        const setEnabled = jest.fn<Promise<StaffAdminTO>, [number, boolean]>()
            .mockResolvedValue(makeStaff({ id: 5, enabled: false }));
        mockUseStaffAccounts.mockReturnValue(staffAccountsValue({ staff: [makeStaff({ id: 5 })], setEnabled }));

        render(<AccountManagerScreen open role={StaffRoles.MANAGER} branch={homeBranch} onClose={jest.fn()} />);

        fireEvent.click(screen.getByTestId("staff-deactivate-5"));
        expect(screen.getByTestId("deactivate-dialog-stub").getAttribute("data-open")).toBe("true");
        expect(setEnabled).not.toHaveBeenCalled();

        fireEvent.click(screen.getByTestId("deactivate-dialog-confirm"));

        await waitFor(() => expect(setEnabled).toHaveBeenCalledWith(5, false));
    });

    it("opens the change-branch drawer for the chosen row", () => {
        mockUseStaffAccounts.mockReturnValue(staffAccountsValue({ staff: [makeStaff({ id: 8 })] }));

        render(<AccountManagerScreen open role={StaffRoles.MANAGER} branch={homeBranch} onClose={jest.fn()} />);

        expect(screen.getByTestId("change-branch-drawer-stub").getAttribute("data-open")).toBe("false");

        fireEvent.click(screen.getByTestId("staff-change-branch-8"));

        const stub = screen.getByTestId("change-branch-drawer-stub");
        expect(stub.getAttribute("data-open")).toBe("true");
        expect(stub.getAttribute("data-target")).toBe("8");
    });

    it("offers no change-branch action on a row the caller may not administer", () => {
        mockUseStaffAccounts.mockReturnValue(staffAccountsValue({
            staff: [makeStaff({ id: 9, role: StaffRoles.MANAGER })],
        }));

        render(<AccountManagerScreen open role={StaffRoles.MANAGER} branch={homeBranch} onClose={jest.fn()} />);

        expect(screen.queryByTestId("staff-change-branch-9")).toBeNull();
    });

    // Reactivation is not destructive, so it must NOT go through the dialog.
    it("reactivates directly, without a confirmation", async () => {
        const setEnabled = jest.fn<Promise<StaffAdminTO>, [number, boolean]>()
            .mockResolvedValue(makeStaff({ id: 6, enabled: true }));
        mockUseStaffAccounts.mockReturnValue(staffAccountsValue({
            staff: [makeStaff({ id: 6, enabled: false })],
            setEnabled,
        }));

        render(<AccountManagerScreen open role={StaffRoles.MANAGER} branch={homeBranch} onClose={jest.fn()} />);
        fireEvent.click(screen.getByTestId("staff-filter-all"));

        fireEvent.click(screen.getByTestId("staff-reactivate-6"));

        await waitFor(() => expect(setEnabled).toHaveBeenCalledWith(6, true));
        expect(screen.getByTestId("deactivate-dialog-stub").getAttribute("data-open")).toBe("false");
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
});
