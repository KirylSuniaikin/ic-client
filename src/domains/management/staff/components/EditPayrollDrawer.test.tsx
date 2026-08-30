import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { StaffRoles } from "../../../auth/types";
import type { StaffAdminTO, UpdateStaffPayrollRequest } from "../types";
import EditPayrollDrawer from "./EditPayrollDrawer";

function makeStaff(overrides: Partial<StaffAdminTO> = {}): StaffAdminTO {
    return {
        id: 5,
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

describe("EditPayrollDrawer", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    function renderDrawer(
        target: StaffAdminTO | null = makeStaff(),
        updatePayroll = jest.fn<Promise<void>, [number, UpdateStaffPayrollRequest]>(),
    ): typeof updatePayroll {
        render(
            <EditPayrollDrawer open target={target} onClose={jest.fn<void, []>()} updatePayroll={updatePayroll} />,
        );
        return updatePayroll;
    }

    it("prefills the fields from the target's current payroll", () => {
        renderDrawer(makeStaff({
            cprNumber: "830101234",
            basicSalary: 240,
            housingAllowance: 60,
            transportAllowance: null,
        }));

        expect((screen.getByLabelText("CPR No.") as HTMLInputElement).value).toBe("830101234");
        expect((screen.getByLabelText("Basic salary") as HTMLInputElement).value).toBe("240");
        expect((screen.getByLabelText("Housing allowance") as HTMLInputElement).value).toBe("60");
        expect((screen.getByLabelText("Transport allowance") as HTMLInputElement).value).toBe("");
    });

    it("submits all four fields, including unset ones as null", async () => {
        const updatePayroll = renderDrawer(makeStaff({
            cprNumber: "830101234",
            basicSalary: 240,
            housingAllowance: null,
            transportAllowance: null,
        }));

        fireEvent.click(screen.getByTestId("edit-payroll-submit"));

        await waitFor(() => expect(updatePayroll).toHaveBeenCalledWith(5, {
            cprNumber: "830101234",
            basicSalary: 240,
            housingAllowance: null,
            transportAllowance: null,
        }));
    });

    it("shows a BD adornment and a three-decimal step on every amount field", () => {
        renderDrawer();

        expect(screen.getAllByText("BD")).toHaveLength(3);
        expect(screen.getByLabelText("Basic salary").getAttribute("step")).toBe("0.001");
        expect(screen.getByLabelText("Housing allowance").getAttribute("step")).toBe("0.001");
        expect(screen.getByLabelText("Transport allowance").getAttribute("step")).toBe("0.001");
    });

    it("submits a whitespace-only CPR as null, same as an empty amount", async () => {
        const updatePayroll = renderDrawer(makeStaff({
            cprNumber: "830101234",
            basicSalary: null,
            housingAllowance: null,
            transportAllowance: null,
        }));

        fireEvent.change(screen.getByLabelText("CPR No."), { target: { value: "   " } });
        fireEvent.click(screen.getByTestId("edit-payroll-submit"));

        await waitFor(() => expect(updatePayroll).toHaveBeenCalledWith(5, {
            cprNumber: null,
            basicSalary: null,
            housingAllowance: null,
            transportAllowance: null,
        }));
    });

    it("submits an edited amount as a number and a cleared field as null", async () => {
        const updatePayroll = renderDrawer(makeStaff({
            cprNumber: "830101234",
            basicSalary: 240,
            housingAllowance: 60,
            transportAllowance: 40,
        }));

        fireEvent.change(screen.getByLabelText("Basic salary"), { target: { value: "310.960" } });
        fireEvent.change(screen.getByLabelText("Transport allowance"), { target: { value: "" } });
        fireEvent.click(screen.getByTestId("edit-payroll-submit"));

        await waitFor(() => expect(updatePayroll).toHaveBeenCalledWith(5, {
            cprNumber: "830101234",
            basicSalary: 310.96,
            housingAllowance: 60,
            transportAllowance: null,
        }));
    });

    // `type="number"` + min="0" are browser hints only -- a pasted value reaches state unchanged,
    // and these amounts end up printed on a document an employee signs.
    it("blocks saving and explains why when an amount is negative", () => {
        const updatePayroll = renderDrawer();

        fireEvent.change(screen.getByLabelText("Basic salary"), { target: { value: "-50" } });

        expect(screen.getByTestId("edit-payroll-error").textContent).toContain("must not be negative");
        expect((screen.getByTestId("edit-payroll-submit") as HTMLButtonElement).disabled).toBe(true);

        fireEvent.click(screen.getByTestId("edit-payroll-submit"));
        expect(updatePayroll).not.toHaveBeenCalled();
    });

    it("still allows zero, which is a legal amount that simply omits the slip row", () => {
        renderDrawer();

        fireEvent.change(screen.getByLabelText("Transport allowance"), { target: { value: "0" } });

        expect(screen.queryByTestId("edit-payroll-error")).toBeNull();
        expect((screen.getByTestId("edit-payroll-submit") as HTMLButtonElement).disabled).toBe(false);
    });

    it("shows the failure inline and stays open when the save is rejected", async () => {
        const updatePayroll = jest.fn<Promise<void>, [number, UpdateStaffPayrollRequest]>()
            .mockRejectedValue(new Error("HTTP 403"));
        renderDrawer(makeStaff(), updatePayroll);

        fireEvent.click(screen.getByTestId("edit-payroll-submit"));

        expect(await screen.findByTestId("edit-payroll-error")).toBeTruthy();
    });

    it("clears the form and any prior error when reopened for a different target", () => {
        const { rerender } = render(
            <EditPayrollDrawer
                open={false}
                target={makeStaff({ id: 5, cprNumber: "830101234" })}
                onClose={jest.fn<void, []>()}
                updatePayroll={jest.fn<Promise<void>, [number, UpdateStaffPayrollRequest]>()}
            />,
        );

        rerender(
            <EditPayrollDrawer
                open
                target={makeStaff({ id: 6, cprNumber: null })}
                onClose={jest.fn<void, []>()}
                updatePayroll={jest.fn<Promise<void>, [number, UpdateStaffPayrollRequest]>()}
            />,
        );

        expect((screen.getByLabelText("CPR No.") as HTMLInputElement).value).toBe("");
        expect(screen.queryByTestId("edit-payroll-error")).toBeNull();
    });
});
