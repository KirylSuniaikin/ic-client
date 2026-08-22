import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { StaffRoles } from "../../../auth/types";
import type { UseStaffRegisterResult } from "../hooks/useStaffRegister";
import type { HireStaffRequest, HiredStaffTO, StaffAdminTO } from "../types";

// The staff auth context decodes a JWT out of storage on mount; the screen only reads
// `branchId`, so stub the hook rather than standing up a real provider (same pattern as
// AccountingReportPopup.test.tsx).
const mockUseAuth = jest.fn<{ branchId: string | null }, []>();
jest.mock("../../../auth/context/AuthProvider", () => ({
    useAuth: () => mockUseAuth(),
}));

// Isolates StaffRegisterScreen's own composition (list rendering, OWNER-only price column,
// Hire button wiring) from the hook's own internals, which have their own useStaffRegister.test.ts.
jest.mock("../hooks/useStaffRegister");

// HireStaffDrawer has its own dedicated test file — stub it here so this file only asserts
// that StaffRegisterScreen opens/closes it and wires `create` through.
function mockHireStaffDrawer({ open }: { open: boolean; onClose: () => void; create: unknown }): JSX.Element {
    return <div data-testid="hire-staff-drawer-stub" data-open={open ? "true" : "false"} />;
}
jest.mock("./HireStaffDrawer", () => ({
    __esModule: true,
    default: mockHireStaffDrawer,
}));

import { useStaffRegister } from "../hooks/useStaffRegister";
import StaffRegisterScreen from "./StaffRegisterScreen";

const mockUseStaffRegister = jest.mocked(useStaffRegister);

function makeStaff(overrides: Partial<StaffAdminTO> = {}): StaffAdminTO {
    return {
        id: 1,
        username: "casey.cook",
        fullName: "Casey Cook",
        role: StaffRoles.COOK,
        branchId: "branch-1",
        pricePerHour: null,
        ...overrides,
    };
}

function staffRegisterValue(overrides: Partial<UseStaffRegisterResult> = {}): UseStaffRegisterResult {
    return {
        staff: [],
        loading: false,
        error: null,
        create: jest.fn<Promise<HiredStaffTO>, [HireStaffRequest]>(),
        refresh: jest.fn<void, []>(),
        ...overrides,
    };
}

describe("StaffRegisterScreen", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUseAuth.mockReturnValue({ branchId: "branch-1" });
        mockUseStaffRegister.mockReturnValue(staffRegisterValue());
    });

    it("renders fullName with username fallback for staff whose fullName is null", () => {
        mockUseStaffRegister.mockReturnValue(staffRegisterValue({
            staff: [
                makeStaff({ id: 1, fullName: "Casey Cook", username: "casey.cook" }),
                makeStaff({ id: 2, fullName: null, username: "no.name.yet" }),
            ],
        }));

        render(<StaffRegisterScreen role={StaffRoles.MANAGER} />);

        expect(within(screen.getByTestId("staff-row-1")).getByText("Casey Cook")).toBeTruthy();
        // Row 2 has no fullName -- both the Name and Login cells fall back to the username,
        // so "no.name.yet" legitimately appears twice within that one row.
        expect(within(screen.getByTestId("staff-row-2")).getAllByText("no.name.yet")).toHaveLength(2);
    });

    it("omits the price/hour column for a non-OWNER viewer", () => {
        mockUseStaffRegister.mockReturnValue(staffRegisterValue({ staff: [makeStaff({ pricePerHour: 5 })] }));

        render(<StaffRegisterScreen role={StaffRoles.MANAGER} />);

        expect(screen.queryByText("Price/hour")).toBeNull();
    });

    it("shows the price/hour column for an OWNER viewer, blank when pricePerHour is null", () => {
        mockUseStaffRegister.mockReturnValue(staffRegisterValue({
            staff: [makeStaff({ id: 1, pricePerHour: null })],
        }));

        render(<StaffRegisterScreen role={StaffRoles.OWNER} />);

        expect(screen.getByText("Price/hour")).toBeTruthy();
    });

    it("scopes the fetch to the caller's own branch for a non-city role", () => {
        mockUseAuth.mockReturnValue({ branchId: "branch-7" });

        render(<StaffRegisterScreen role={StaffRoles.MANAGER} />);

        expect(mockUseStaffRegister).toHaveBeenCalledWith("branch-7");
    });

    it("does not scope the fetch to a single branch for a city-access role", () => {
        mockUseAuth.mockReturnValue({ branchId: "branch-7" });

        render(<StaffRegisterScreen role={StaffRoles.OWNER} />);

        expect(mockUseStaffRegister).toHaveBeenCalledWith(undefined);
    });

    it("opens the HireStaffDrawer when the Hire button is clicked", () => {
        render(<StaffRegisterScreen role={StaffRoles.MANAGER} />);

        expect(screen.getByTestId("hire-staff-drawer-stub").getAttribute("data-open")).toBe("false");

        fireEvent.click(screen.getByTestId("staff-hire-button"));

        expect(screen.getByTestId("hire-staff-drawer-stub").getAttribute("data-open")).toBe("true");
    });

    it("surfaces a hook error via the ErrorSnackbar", () => {
        mockUseStaffRegister.mockReturnValue(staffRegisterValue({ error: "HTTP 500" }));

        render(<StaffRegisterScreen role={StaffRoles.MANAGER} />);

        expect(screen.getByText("HTTP 500")).toBeTruthy();
    });
});
