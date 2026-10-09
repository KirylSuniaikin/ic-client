import { jest, describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { StaffRoles } from "../../../auth/types";
import type { StaffAdminTO } from "../../staff/types";
import type { RefusalActRequest } from "../types";
import RefusalActDrawer from "./RefusalActDrawer";

type Submit = (r: RefusalActRequest) => Promise<void>;

function staff(id: number, role: StaffRoles, enabled = true): StaffAdminTO {
    return {
        id, username: `u${id}`, fullName: `Person ${id}`, role, branchId: "b1", pricePerHour: null, enabled,
        cprNumber: null, basicSalary: null, housingAllowance: null, transportAllowance: null, telegramConnected: false,
    };
}

const roster: StaffAdminTO[] = [
    staff(7, StaffRoles.MANAGER), // the employee
    staff(1, StaffRoles.COOK),
    staff(2, StaffRoles.SUPERVISOR),
    staff(3, StaffRoles.MANAGER),
    staff(4, StaffRoles.SUPER_MANAGER),
    staff(5, StaffRoles.OWNER),
    staff(6, StaffRoles.OWNER, false),
];

function setup(onSubmit: Submit) {
    const onClose = jest.fn();
    render(<RefusalActDrawer open employeeId={7} roster={roster} onSubmit={onSubmit} onClose={onClose} />);
    return { onClose };
}

function optionNames(label: string): string[] {
    fireEvent.mouseDown(screen.getByLabelText(label));
    return within(screen.getByRole("listbox")).getAllByRole("option").map((o) => o.textContent ?? "");
}

function pick(label: string, name: string): void {
    fireEvent.mouseDown(screen.getByLabelText(label));
    fireEvent.click(within(screen.getByRole("listbox")).getByText(name));
}

const submitButton = (): HTMLButtonElement => screen.getByRole("button", { name: "Record refusal" }) as HTMLButtonElement;

describe("RefusalActDrawer", () => {
    it("has the spec title", () => {
        setup(jest.fn<Promise<void>, [RefusalActRequest]>());

        expect(screen.getByText("Record refusal to sign")).toBeTruthy();
    });

    it("offers MANAGER/SUPER_MANAGER/OWNER as shift chief, never the employee, COOK, SUPERVISOR or disabled staff", () => {
        setup(jest.fn<Promise<void>, [RefusalActRequest]>());

        expect(optionNames("Shift chief")).toEqual(["Person 3", "Person 4", "Person 5"]);
    });

    it("offers only SUPER_MANAGER/OWNER as GM, never a MANAGER or the employee", () => {
        setup(jest.fn<Promise<void>, [RefusalActRequest]>());

        expect(optionNames("General Manager / Owner")).toEqual(["Person 4", "Person 5"]);
    });

    it("excludes the chosen shift chief from the GM list", () => {
        setup(jest.fn<Promise<void>, [RefusalActRequest]>());
        pick("Shift chief", "Person 4");

        expect(optionNames("General Manager / Owner")).toEqual(["Person 5"]);
    });

    it("keeps submit disabled until both are chosen", () => {
        setup(jest.fn<Promise<void>, [RefusalActRequest]>());
        expect(submitButton().disabled).toBe(true);

        pick("Shift chief", "Person 3");
        expect(submitButton().disabled).toBe(true);
        pick("General Manager / Owner", "Person 5");
        expect(submitButton().disabled).toBe(false);
    });

    it("submits shiftChiefStaffId and gmStaffId, then closes", async () => {
        const onSubmit = jest.fn<Promise<void>, [RefusalActRequest]>().mockResolvedValue(undefined);
        const { onClose } = setup(onSubmit);
        pick("Shift chief", "Person 3");
        pick("General Manager / Owner", "Person 5");

        fireEvent.click(submitButton());

        await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
        expect(onSubmit).toHaveBeenCalledWith({ shiftChiefStaffId: 3, gmStaffId: 5 });
    });

    it("shows the server 400 message and stays open", async () => {
        const onSubmit = jest.fn<Promise<void>, [RefusalActRequest]>().mockRejectedValue(new Error("GM must be SUPER_MANAGER or OWNER"));
        const { onClose } = setup(onSubmit);
        pick("Shift chief", "Person 3");
        pick("General Manager / Owner", "Person 5");

        fireEvent.click(submitButton());

        expect((await screen.findByRole("alert")).textContent).toBe("GM must be SUPER_MANAGER or OWNER");
        expect(onClose).not.toHaveBeenCalled();
    });
});
