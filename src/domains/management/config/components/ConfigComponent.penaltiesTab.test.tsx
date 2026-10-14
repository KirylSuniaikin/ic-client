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

jest.mock("../../../../shared/api/public");
jest.mock("../../../../shared/api/management");
jest.mock("./ScheduleView", () => ({ __esModule: true, default: () => null }));
jest.mock("./PenaltiesView", () => ({
    __esModule: true,
    default: (props: Record<string, unknown>) => (
        <div data-testid="penalties-view" data-props={Object.keys(props).join(",")}>Penalties stub</div>
    ),
}));

const mockFetchBaseAppInfo = jest.mocked(fetchBaseAppInfo);
const mockGetDoughInventory = jest.mocked(getDoughInventory);

const BRANCH_A: IBranch = { id: "branch-a", externalId: "A", branchNo: 1, branchName: "Al Hidd", locale: "en", latitude: null, longitude: null };
const BRANCH_B: IBranch = { id: "branch-b", externalId: "B", branchNo: 2, branchName: "Riffa", locale: "en", latitude: null, longitude: null };

function renderConfig(role: StaffRoles): void {
    render(
        <ManagementBranchScopeProvider branches={[BRANCH_A, BRANCH_B]} homeBranch={BRANCH_A}>
            <ConfigComponent isOpen onClose={jest.fn()} selectedBranch={BRANCH_A} role={role} />
        </ManagementBranchScopeProvider>,
    );
}

const branchSelector = (): HTMLElement | null => screen.queryByText("Branch", { selector: "label" });

describe("ConfigComponent Penalties tab", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFetchBaseAppInfo.mockResolvedValue({ menu: [] } as unknown as BaseAppInfoResponse);
        mockGetDoughInventory.mockResolvedValue({ S: 0, M: 0, L: 0, Brick: 0 } as unknown as DoughStatus);
    });

    it.each([StaffRoles.SUPER_MANAGER, StaffRoles.OWNER])("shows the Penalties button for %s", async (role) => {
        renderConfig(role);
        await waitFor(() => expect(screen.getByText("Menu Availability")).toBeTruthy());

        expect(screen.getByRole("button", { name: "Penalties" })).toBeTruthy();
    });

    it("hides the Penalties button for MANAGER but keeps Menu and Schedule", async () => {
        renderConfig(StaffRoles.MANAGER);
        await waitFor(() => expect(screen.getByText("Menu Availability")).toBeTruthy());

        expect(screen.queryByRole("button", { name: "Penalties" })).toBeNull();
        expect(screen.getByRole("button", { name: "Menu" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Schedule" })).toBeTruthy();
    });

    it("renders PenaltiesView without props and removes the Menu body, then restores it", async () => {
        renderConfig(StaffRoles.SUPER_MANAGER);
        await waitFor(() => expect(screen.getByText("Menu Availability")).toBeTruthy());

        await userEvent.click(screen.getByRole("button", { name: "Penalties" }));

        expect(screen.getByTestId("penalties-view").getAttribute("data-props")).toBe("");
        expect(screen.queryByText("Menu Availability")).toBeNull();

        await userEvent.click(screen.getByRole("button", { name: "Menu" }));

        expect(screen.getByText("Menu Availability")).toBeTruthy();
        expect(screen.queryByTestId("penalties-view")).toBeNull();
    });

    it("hides the branch selector on Penalties and shows it on Menu and Schedule", async () => {
        renderConfig(StaffRoles.OWNER);
        await waitFor(() => expect(branchSelector()).toBeTruthy());

        await userEvent.click(screen.getByRole("button", { name: "Penalties" }));
        expect(branchSelector()).toBeNull();

        await userEvent.click(screen.getByRole("button", { name: "Schedule" }));
        expect(branchSelector()).toBeTruthy();

        await userEvent.click(screen.getByRole("button", { name: "Penalties" }));
        expect(branchSelector()).toBeNull();

        await userEvent.click(screen.getByRole("button", { name: "Menu" }));
        await waitFor(() => expect(branchSelector()).toBeTruthy());
    });
});
