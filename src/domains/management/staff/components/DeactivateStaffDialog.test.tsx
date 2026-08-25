import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { StaffRoles } from "../../../auth/types";
import type { StaffAdminTO } from "../types";
import DeactivateStaffDialog from "./DeactivateStaffDialog";

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

describe("DeactivateStaffDialog", () => {
    beforeEach(() => jest.clearAllMocks());

    it("names the person being deactivated", () => {
        render(
            <DeactivateStaffDialog
                open
                target={makeStaff()}
                submitting={false}
                onConfirm={jest.fn<void, []>()}
                onCancel={jest.fn<void, []>()}
            />,
        );

        expect(screen.getByTestId("deactivate-staff-dialog").textContent).toContain("Casey Cook");
    });

    // The copy promises immediate sign-out, which is only true because TokenFilter checks
    // Staff.enabled on every request. If that check is ever removed this sentence becomes a lie.
    it("says the session ends immediately", () => {
        render(
            <DeactivateStaffDialog
                open
                target={makeStaff()}
                submitting={false}
                onConfirm={jest.fn<void, []>()}
                onCancel={jest.fn<void, []>()}
            />,
        );

        expect(screen.getByTestId("deactivate-staff-dialog").textContent).toContain("signed out");
    });

    it("falls back to the login when there is no full name", () => {
        render(
            <DeactivateStaffDialog
                open
                target={makeStaff({ fullName: null })}
                submitting={false}
                onConfirm={jest.fn<void, []>()}
                onCancel={jest.fn<void, []>()}
            />,
        );

        expect(screen.getByTestId("deactivate-staff-dialog").textContent).toContain("casey.cook");
    });

    it("wires confirm and cancel", () => {
        const onConfirm = jest.fn<void, []>();
        const onCancel = jest.fn<void, []>();
        render(
            <DeactivateStaffDialog
                open
                target={makeStaff()}
                submitting={false}
                onConfirm={onConfirm}
                onCancel={onCancel}
            />,
        );

        fireEvent.click(screen.getByText("Cancel"));
        expect(onCancel).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByTestId("deactivate-staff-confirm"));
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it("disables both buttons while the request is in flight", () => {
        render(
            <DeactivateStaffDialog
                open
                target={makeStaff()}
                submitting
                onConfirm={jest.fn<void, []>()}
                onCancel={jest.fn<void, []>()}
            />,
        );

        // jest-dom's toBeDisabled is not available with the imported expect, and getByText
        // returns MUI's inner span rather than the button -- hence closest("button").
        expect(screen.getByTestId("deactivate-staff-confirm").hasAttribute("disabled")).toBe(true);
        expect(screen.getByText("Cancel").closest("button")?.hasAttribute("disabled")).toBe(true);
    });
});
