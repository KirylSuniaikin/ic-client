import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConfigComponent from "./ConfigComponent";
import { ManagementBranchScopeProvider } from "../../_shared/context/ManagementBranchScope";
import { fetchBaseAppInfo } from "../../../../shared/api/public";
import { getDoughInventory } from "../../../../shared/api/management";
import { StaffRoles } from "../../../auth/types";
import type { IBranch } from "../../inventory/types";
import type { BaseAppInfoResponse } from "../../../order/types";
import type { DoughStatus } from "../../dough/types";

// jsdom has no canvas backend, so PizzaLoader's unconditional Lottie import crashes the
// environment on load. Same stub the other management tests use.
jest.mock("lottie-react", () => ({
    __esModule: true,
    default: (): null => null,
}));

jest.mock("../../../../shared/api/public");
jest.mock("../../../../shared/api/management");

// ScheduleView owns useSchedule, which would fire its own request the moment the
// Schedule tab mounts. The selector is what's under test here, not the schedule.
jest.mock("./ScheduleView", () => ({
    __esModule: true,
    default: () => null,
}));

const mockFetchBaseAppInfo = jest.mocked(fetchBaseAppInfo);
const mockGetDoughInventory = jest.mocked(getDoughInventory);

const BRANCH_A: IBranch = {
    id: "branch-a", externalId: "A", branchNo: 1, branchName: "Al Hidd", locale: "en",
};
const BRANCH_B: IBranch = {
    id: "branch-b", externalId: "B", branchNo: 2, branchName: "Riffa", locale: "en",
};

function renderConfig(branches: IBranch[]): void {
    render(
        <ManagementBranchScopeProvider branches={branches} homeBranch={BRANCH_A}>
            <ConfigComponent
                isOpen
                onClose={jest.fn()}
                selectedBranch={BRANCH_A}
                role={StaffRoles.SUPER_MANAGER}
            />
        </ManagementBranchScopeProvider>,
    );
}

const branchSelector = (): HTMLElement | null => screen.queryByText("Branch", { selector: "label" });

describe("ConfigComponent branch selector", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFetchBaseAppInfo.mockResolvedValue({ menu: [] } as unknown as BaseAppInfoResponse);
        mockGetDoughInventory.mockResolvedValue({ S: 0, M: 0, L: 0, Brick: 0 } as unknown as DoughStatus);
    });

    it("renders the selector on the Menu tab", async () => {
        renderConfig([BRANCH_A, BRANCH_B]);

        await waitFor(() => expect(branchSelector()).toBeTruthy());
    });

    // Regression: the selector used to be gated on activeTab === "Menu". ScheduleView had
    // its own picker at the time; once that was removed in favour of the shared scope the
    // Schedule tab was left with no way to switch branch at all.
    it("keeps the selector visible after switching to the Schedule tab", async () => {
        renderConfig([BRANCH_A, BRANCH_B]);
        await waitFor(() => expect(branchSelector()).toBeTruthy());

        await userEvent.click(screen.getByRole("button", { name: "Schedule" }));

        expect(branchSelector()).toBeTruthy();
    });

    it("hides the selector when only one branch is available", async () => {
        renderConfig([BRANCH_A]);

        await waitFor(() => expect(screen.getByText("Menu Availability")).toBeTruthy());
        expect(branchSelector()).toBeNull();
    });
});
