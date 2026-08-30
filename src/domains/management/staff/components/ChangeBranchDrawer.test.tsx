import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { fetchAllBranches } from "../../../../shared/api/management";
import { StaffRoles } from "../../../auth/types";
import type { IBranch } from "../../inventory/types";
import type { StaffAdminTO } from "../types";
import ChangeBranchDrawer from "./ChangeBranchDrawer";

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
        pricePerHour: null,
        enabled: true,
        cprNumber: null,
        basicSalary: null,
        housingAllowance: null,
        transportAllowance: null,
        ...overrides,
    };
}

describe("ChangeBranchDrawer", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFetchAllBranches.mockResolvedValue([home, seef]);
    });

    async function openDrawer(changeBranch = jest.fn<Promise<void>, [number, string]>()): Promise<typeof changeBranch> {
        render(
            <ChangeBranchDrawer open target={makeStaff()} onClose={jest.fn<void, []>()} changeBranch={changeBranch} />,
        );
        await waitFor(() => expect(mockFetchAllBranches).toHaveBeenCalled());
        return changeBranch;
    }

    // The whole reason this fetches instead of reading ManagementBranchScope: that context gives
    // a MANAGER only their own branch, which is precisely the one branch a transfer cannot target.
    it("loads the full branch list rather than the caller's own scope", async () => {
        await openDrawer();
        expect(mockFetchAllBranches).toHaveBeenCalledTimes(1);
    });

    it("excludes the branch the person is already at", async () => {
        await openDrawer();

        fireEvent.mouseDown(screen.getByRole("combobox"));

        expect(screen.getByRole("option", { name: "Seef" })).toBeTruthy();
        expect(screen.queryByRole("option", { name: "Main" })).toBeNull();
    });

    it("submits the chosen branch for the target", async () => {
        const changeBranch = await openDrawer();

        fireEvent.mouseDown(screen.getByRole("combobox"));
        fireEvent.click(screen.getByRole("option", { name: "Seef" }));
        fireEvent.click(screen.getByTestId("change-branch-submit"));

        await waitFor(() => expect(changeBranch).toHaveBeenCalledWith(5, "branch-2"));
    });

    it("keeps Move disabled until a branch is chosen", async () => {
        await openDrawer();

        expect(screen.getByTestId("change-branch-submit").hasAttribute("disabled")).toBe(true);

        fireEvent.mouseDown(screen.getByRole("combobox"));
        fireEvent.click(screen.getByRole("option", { name: "Seef" }));

        expect(screen.getByTestId("change-branch-submit").hasAttribute("disabled")).toBe(false);
    });

    it("shows the failure inline and stays open when the move is rejected", async () => {
        const changeBranch = jest.fn<Promise<void>, [number, string]>()
            .mockRejectedValue(new Error("Response: 403"));
        await openDrawer(changeBranch);

        fireEvent.mouseDown(screen.getByRole("combobox"));
        fireEvent.click(screen.getByRole("option", { name: "Seef" }));
        fireEvent.click(screen.getByTestId("change-branch-submit"));

        expect(await screen.findByTestId("change-branch-error")).toBeTruthy();
    });

    it("reports a failure to load the branch list", async () => {
        mockFetchAllBranches.mockRejectedValue(new Error("Response: 500"));
        render(
            <ChangeBranchDrawer
                open
                target={makeStaff()}
                onClose={jest.fn<void, []>()}
                changeBranch={jest.fn<Promise<void>, [number, string]>()}
            />,
        );

        expect(await screen.findByTestId("change-branch-error")).toBeTruthy();
    });
});
