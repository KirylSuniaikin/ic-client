import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShiftHomePage } from "./ShiftHomePage";
import { ManagementBranchScopeProvider } from "../../_shared/context/ManagementBranchScope";
import { getReports } from "../../../../shared/api/management";
import type { IBranch } from "../../inventory/types";

jest.mock("../../../../shared/api/management");

// ShiftTablePopup is only reachable behind "New Report" and pulls in the whole editable
// table; the selector is what's under test.
jest.mock("./ShiftTablePopup", () => ({
    ShiftTablePopup: (): null => null,
}));

const mockGetReports = jest.mocked(getReports);

const BRANCH_A: IBranch = {
    id: "branch-a", externalId: "A", branchNo: 1, branchName: "Al Hidd", locale: "en",
};
const BRANCH_B: IBranch = {
    id: "branch-b", externalId: "B", branchNo: 2, branchName: "Riffa", locale: "en",
};

function renderShifts(branches: IBranch[]): void {
    render(
        <ManagementBranchScopeProvider branches={branches} homeBranch={BRANCH_A}>
            <ShiftHomePage open onClose={jest.fn()} branch={BRANCH_A} />
        </ManagementBranchScopeProvider>,
    );
}

const branchSelector = (): HTMLElement | null => screen.queryByText("Branch", { selector: "label" });

describe("ShiftHomePage branch selector", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetReports.mockResolvedValue([]);
    });

    it("loads the homepage branch's reports and offers a selector", async () => {
        renderShifts([BRANCH_A, BRANCH_B]);

        await waitFor(() => expect(branchSelector()).toBeTruthy());
        expect(mockGetReports).toHaveBeenCalledWith({ branchId: "branch-a", reportType: "SHIFT_REPORT" });
    });

    it("refetches for the newly selected branch", async () => {
        renderShifts([BRANCH_A, BRANCH_B]);
        await waitFor(() => expect(branchSelector()).toBeTruthy());

        await userEvent.click(screen.getByRole("combobox"));
        await userEvent.click(screen.getByRole("option", { name: "Riffa" }));

        await waitFor(() =>
            expect(mockGetReports).toHaveBeenCalledWith({ branchId: "branch-b", reportType: "SHIFT_REPORT" }),
        );
    });

    it("hides the selector when only one branch is available", async () => {
        renderShifts([BRANCH_A]);

        await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
        expect(branchSelector()).toBeNull();
    });
});
