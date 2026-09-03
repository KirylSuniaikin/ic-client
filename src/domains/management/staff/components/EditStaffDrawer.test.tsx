import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { fetchAllBranches } from "../../../../shared/api/management";
import { StaffRoles } from "../../../auth/types";
import type { IBranch } from "../../inventory/types";
import type { StaffAdminTO, UpdateStaffDetailsRequest, UpdateStaffPayrollRequest } from "../types";
import EditStaffDrawer from "./EditStaffDrawer";

jest.mock("../../../../shared/api/management");
const mockFetchAllBranches = jest.mocked(fetchAllBranches);

const home: IBranch = { id: "branch-1", externalId: "b1", branchNo: 1, branchName: "Main", locale: "BH" };
const seef: IBranch = { id: "branch-2", externalId: "b2", branchNo: 2, branchName: "Seef", locale: "BH" };

function makeStaff(overrides: Partial<StaffAdminTO> = {}): StaffAdminTO {
    return {
        id: 5,
        username: "casey.cook",
        fullName: "Casey Cook",
        role: StaffRoles.COOK,
        branchId: "branch-1",
        pricePerHour: 3,
        enabled: true,
        cprNumber: null,
        basicSalary: null,
        housingAllowance: null,
        transportAllowance: null,
        ...overrides,
    };
}

type RenderOverrides = {
    target?: StaffAdminTO | null;
    callerRole?: StaffRoles | null;
};

type RenderDrawerResult = {
    updateDetails: ReturnType<typeof jest.fn<Promise<StaffAdminTO>, [number, UpdateStaffDetailsRequest]>>;
    changeBranch: ReturnType<typeof jest.fn<Promise<StaffAdminTO>, [number, string]>>;
    updatePayroll: ReturnType<typeof jest.fn<Promise<StaffAdminTO>, [number, UpdateStaffPayrollRequest]>>;
    setEnabled: ReturnType<typeof jest.fn<Promise<StaffAdminTO>, [number, boolean]>>;
};

// The branch-loading effect now fires for every caller (Issue 1 fix: Branch is ungated, matching
// ChangeBranchDrawer's original behaviour), so this always awaits the fetch before the test
// interacts with anything, keeping the assertions from racing the drawer's own state updates.
async function renderDrawer(overrides: RenderOverrides = {}): Promise<RenderDrawerResult> {
    const updateDetails = jest.fn<Promise<StaffAdminTO>, [number, UpdateStaffDetailsRequest]>().mockResolvedValue(makeStaff());
    const changeBranch = jest.fn<Promise<StaffAdminTO>, [number, string]>().mockResolvedValue(makeStaff());
    const updatePayroll = jest.fn<Promise<StaffAdminTO>, [number, UpdateStaffPayrollRequest]>().mockResolvedValue(makeStaff());
    const setEnabled = jest.fn<Promise<StaffAdminTO>, [number, boolean]>().mockResolvedValue(makeStaff());
    const target = overrides.target === undefined ? makeStaff() : overrides.target;
    const callerRole = overrides.callerRole === undefined ? StaffRoles.OWNER : overrides.callerRole;

    render(
        <EditStaffDrawer
            open
            target={target}
            callerRole={callerRole}
            onClose={jest.fn<void, []>()}
            updateDetails={updateDetails}
            changeBranch={changeBranch}
            updatePayroll={updatePayroll}
            setEnabled={setEnabled}
        />,
    );

    await waitFor(() => expect(mockFetchAllBranches).toHaveBeenCalled());

    return { updateDetails, changeBranch, updatePayroll, setEnabled };
}

describe("EditStaffDrawer", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFetchAllBranches.mockResolvedValue([home, seef]);
    });

    // Assumption worth locking down: the Branch Select's value must fall back to "" until the
    // fetched branch list actually contains the target's branchId, or MUI logs an out-of-range
    // warning for a value that matches none of the (still empty) MenuItems on the first paint.
    it("does not log an MUI out-of-range warning for the Branch select while branches are still loading", async () => {
        const consoleWarn = jest.spyOn(console, "warn").mockImplementation(() => {});
        let resolveBranches: (branches: IBranch[]) => void = () => {};
        mockFetchAllBranches.mockReturnValue(new Promise(resolve => { resolveBranches = resolve; }));

        render(
            <EditStaffDrawer
                open
                target={makeStaff({ branchId: "branch-1" })}
                callerRole={StaffRoles.OWNER}
                onClose={jest.fn<void, []>()}
                updateDetails={jest.fn<Promise<StaffAdminTO>, [number, UpdateStaffDetailsRequest]>()}
                changeBranch={jest.fn<Promise<StaffAdminTO>, [number, string]>()}
                updatePayroll={jest.fn<Promise<StaffAdminTO>, [number, UpdateStaffPayrollRequest]>()}
                setEnabled={jest.fn<Promise<StaffAdminTO>, [number, boolean]>()}
            />,
        );

        const outOfRangeWarning = consoleWarn.mock.calls.some(call =>
            String(call[0]).includes("out-of-range value"));
        expect(outOfRangeWarning).toBe(false);

        resolveBranches([home, seef]);
        await waitFor(() => expect(screen.getByTestId("edit-staff-branch").textContent).toContain("Main"));

        consoleWarn.mockRestore();
    });

    it("prefills name and role from the target", async () => {
        await renderDrawer({ target: makeStaff({ fullName: "Casey Cook", role: StaffRoles.COOK }) });

        expect((screen.getByLabelText("Full name") as HTMLInputElement).value).toBe("Casey Cook");
        expect(screen.getByTestId("edit-staff-role").textContent).toContain("COOK");
    });

    // Covers the full set of prefilled sections the spec calls out for an OWNER caller: name,
    // role, branch, price/hour and the payroll block all have to read from `target`, not start
    // blank, the moment the drawer opens.
    it("prefills branch, price/hour and the payroll block from the target for an OWNER caller", async () => {
        await renderDrawer({
            callerRole: StaffRoles.OWNER,
            target: makeStaff({
                fullName: "Casey Cook",
                role: StaffRoles.COOK,
                branchId: "branch-2",
                pricePerHour: 3.5,
                cprNumber: "830101234",
                basicSalary: 240,
                housingAllowance: 60,
                transportAllowance: 40,
            }),
        });

        expect(screen.getByTestId("edit-staff-branch").textContent).toContain("Seef");
        expect((screen.getByLabelText("Price/hour") as HTMLInputElement).value).toBe("3.5");
        expect((screen.getByLabelText("CPR No.") as HTMLInputElement).value).toBe("830101234");
        expect((screen.getByLabelText("Basic salary") as HTMLInputElement).value).toBe("240");
        expect((screen.getByLabelText("Housing allowance") as HTMLInputElement).value).toBe("60");
        expect((screen.getByLabelText("Transport allowance") as HTMLInputElement).value).toBe("40");
    });

    // Issue 1 fix: ChangeBranchDrawer never gated the Branch section on the caller's own role --
    // "a manager may send their own staff anywhere" -- so a MANAGER caller must see it too, not
    // just OWNER/SUPER_MANAGER.
    it("renders the Branch section for a non-city-access caller (MANAGER)", async () => {
        await renderDrawer({ callerRole: StaffRoles.MANAGER });

        expect(screen.getByTestId("edit-staff-branch")).toBeTruthy();
    });

    it("selecting a different branch and saving calls changeBranch with the target id and new branch id", async () => {
        const { changeBranch } = await renderDrawer({
            callerRole: StaffRoles.MANAGER,
            target: makeStaff({ branchId: "branch-1" }),
        });

        fireEvent.mouseDown(screen.getByTestId("edit-staff-branch").querySelector("[role='combobox']") as HTMLElement);
        fireEvent.click(screen.getByRole("option", { name: "Seef" }));
        fireEvent.click(screen.getByTestId("edit-staff-submit"));

        await waitFor(() => expect(changeBranch).toHaveBeenCalledWith(5, "branch-2"));
    });

    it("submitting a changed name calls updateDetails with just fullName, omitting unchanged role/price", async () => {
        const { updateDetails } = await renderDrawer({
            callerRole: StaffRoles.MANAGER,
            target: makeStaff({ fullName: "Casey Cook", role: StaffRoles.COOK, pricePerHour: null }),
        });

        fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Casey Baker" } });
        fireEvent.click(screen.getByTestId("edit-staff-submit"));

        await waitFor(() => expect(updateDetails).toHaveBeenCalledWith(5, { fullName: "Casey Baker" }));
    });

    // Issue 3 fix: clearing Full name must never send an empty string -- HireStaffDrawer requires
    // a non-empty name at hire time, so this drawer must not be the one place that can un-set it.
    it("clearing Full name and saving does not send an emptied fullName", async () => {
        const { updateDetails } = await renderDrawer({
            callerRole: StaffRoles.MANAGER,
            target: makeStaff({ fullName: "Casey Cook", role: StaffRoles.COOK, pricePerHour: null }),
        });

        fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "   " } });
        fireEvent.click(screen.getByTestId("edit-staff-submit"));

        await waitFor(() => expect((screen.getByTestId("edit-staff-submit") as HTMLButtonElement).disabled).toBe(false));
        expect(updateDetails).not.toHaveBeenCalled();
    });

    // Payroll is redacted server-side for anyone below OWNER (StaffService.toAdminTO), so a
    // non-OWNER caller must not even see Price/hour or the payroll block.
    it("renders Price/hour and the payroll block only for an OWNER caller", async () => {
        await renderDrawer({ callerRole: StaffRoles.OWNER });

        expect(screen.getByTestId("edit-staff-price")).toBeTruthy();
        expect(screen.getByTestId("edit-payroll-cpr")).toBeTruthy();
        expect(screen.getByTestId("edit-payroll-basic")).toBeTruthy();
        expect(screen.getByTestId("edit-payroll-housing")).toBeTruthy();
        expect(screen.getByTestId("edit-payroll-transport")).toBeTruthy();
    });

    it("hides Price/hour and the payroll block entirely for a non-OWNER caller", async () => {
        await renderDrawer({ callerRole: StaffRoles.MANAGER });

        expect(screen.queryByTestId("edit-staff-price")).toBeNull();
        expect(screen.queryByTestId("edit-payroll-cpr")).toBeNull();
        expect(screen.queryByTestId("edit-payroll-basic")).toBeNull();
        expect(screen.queryByTestId("edit-payroll-housing")).toBeNull();
        expect(screen.queryByTestId("edit-payroll-transport")).toBeNull();
    });

    it("changing Price/hour as owner and saving calls updateDetails including pricePerHour", async () => {
        const { updateDetails } = await renderDrawer({
            callerRole: StaffRoles.OWNER,
            target: makeStaff({ fullName: "Casey Cook", role: StaffRoles.COOK, pricePerHour: 3 }),
        });

        fireEvent.change(screen.getByLabelText("Price/hour"), { target: { value: "4.5" } });
        fireEvent.click(screen.getByTestId("edit-staff-submit"));

        await waitFor(() => expect(updateDetails).toHaveBeenCalledWith(5, { pricePerHour: 4.5 }));
    });

    // The spec asks for combining name+role+price into a single updateDetails call, not one
    // round-trip per changed field, whenever more than one of those three actually changed
    // together.
    it("combines a fullName change and a role change into a single updateDetails call", async () => {
        const { updateDetails } = await renderDrawer({
            callerRole: StaffRoles.MANAGER,
            target: makeStaff({ fullName: "Casey Cook", role: StaffRoles.COOK, pricePerHour: null }),
        });

        fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Casey Baker" } });
        fireEvent.mouseDown(screen.getByTestId("edit-staff-role").querySelector("[role='combobox']") as HTMLElement);
        fireEvent.click(screen.getByRole("option", { name: StaffRoles.SUPERVISOR }));
        fireEvent.click(screen.getByTestId("edit-staff-submit"));

        await waitFor(() => expect(updateDetails).toHaveBeenCalledWith(5, {
            fullName: "Casey Baker",
            role: StaffRoles.SUPERVISOR,
        }));
        expect(updateDetails).toHaveBeenCalledTimes(1);
    });

    it("changing a payroll field and saving calls updatePayroll with the full replacement payload", async () => {
        const { updatePayroll } = await renderDrawer({
            callerRole: StaffRoles.OWNER,
            target: makeStaff({ cprNumber: "830101234", basicSalary: 240, housingAllowance: null, transportAllowance: null }),
        });

        fireEvent.change(screen.getByLabelText("Basic salary"), { target: { value: "310.960" } });
        fireEvent.click(screen.getByTestId("edit-staff-submit"));

        await waitFor(() => expect(updatePayroll).toHaveBeenCalledWith(5, {
            cprNumber: "830101234",
            basicSalary: 310.96,
            housingAllowance: null,
            transportAllowance: null,
        }));
    });

    it("toggling Enabled OFF shows the deactivate confirmation before calling setEnabled", async () => {
        const { setEnabled } = await renderDrawer({ target: makeStaff({ enabled: true }) });

        fireEvent.click(screen.getByRole("switch"));

        expect(screen.getByTestId("deactivate-staff-dialog")).toBeTruthy();
        expect(setEnabled).not.toHaveBeenCalled();

        fireEvent.click(screen.getByTestId("deactivate-staff-confirm"));

        await waitFor(() => expect(setEnabled).toHaveBeenCalledWith(5, false));
    });

    it("cancelling the deactivate confirmation leaves the account enabled", async () => {
        const { setEnabled } = await renderDrawer({ target: makeStaff({ enabled: true }) });

        fireEvent.click(screen.getByRole("switch"));

        // The drawer's own Cancel button and the nested confirm dialog's Cancel button are both
        // on screen at once, so scope the query to MUI's Dialog role rather than a DOM-structure
        // assumption about the confirm button's direct parent.
        fireEvent.click(within(screen.getByRole("dialog")).getByText("Cancel"));

        expect(setEnabled).not.toHaveBeenCalled();
        // MUI's Modal marks the rest of the tree aria-hidden while the confirm dialog is open,
        // and the exit transition can still be mid-flight right after the Cancel click -- `hidden:
        // true` reaches the switch regardless of that transient accessibility state.
        expect((screen.getByRole("switch", { hidden: true }) as HTMLInputElement).checked).toBe(true);
    });

    // Reactivation is not destructive, so it must fire directly, without the confirm dialog.
    it("toggling Enabled ON calls setEnabled(id, true) immediately, no confirmation", async () => {
        const { setEnabled } = await renderDrawer({ target: makeStaff({ enabled: false }) });

        fireEvent.click(screen.getByRole("switch"));

        await waitFor(() => expect(setEnabled).toHaveBeenCalledWith(5, true));
        expect(screen.queryByTestId("deactivate-staff-dialog")).toBeNull();
    });
});
