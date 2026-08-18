import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PrepPlanTable from "./PrepPlanTable";
import type { PrepPlanResponse } from "../../prep-plan/types";

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/management.ts
jest.mock("../../../../shared/api/management");

import { fetchCurrentPrepPlan, generatePrepPlan } from "../../../../shared/api/management";

const mockFetchCurrentPrepPlan = jest.mocked(fetchCurrentPrepPlan);
const mockGeneratePrepPlan = jest.mocked(generatePrepPlan);

const plan: PrepPlanResponse = {
    reportId: 1,
    createdAt: "2026-07-10T08:00:00Z",
    rows: [
        { componentId: 1, name: "Dough Ball", unit: "PIECES", yieldMultiplier: 1, amount: 100 },
    ],
};

describe("PrepPlanTable", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFetchCurrentPrepPlan.mockResolvedValue(plan);
        mockGeneratePrepPlan.mockResolvedValue(plan);
    });

    it("fetches the current plan with the branch ids joined into ONE param", async () => {
        render(<PrepPlanTable branchIds={["branch-1", "branch-2"]} />);

        await waitFor(() => expect(mockFetchCurrentPrepPlan).toHaveBeenCalledWith("branch-1,branch-2"));
    });

    it("refetches with the new joined ids when the branch selection changes", async () => {
        const { rerender } = render(<PrepPlanTable branchIds={["branch-1"]} />);
        await waitFor(() => expect(mockFetchCurrentPrepPlan).toHaveBeenCalledWith("branch-1"));

        rerender(<PrepPlanTable branchIds={["branch-1", "branch-2"]} />);

        await waitFor(() => expect(mockFetchCurrentPrepPlan).toHaveBeenCalledWith("branch-1,branch-2"));
    });

    it("fans out one generate POST per selected branch on Regenerate, then reloads the merged plan", async () => {
        render(<PrepPlanTable branchIds={["branch-1", "branch-2"]} />);

        await screen.findByText("Regenerate");
        mockFetchCurrentPrepPlan.mockClear();

        await userEvent.click(screen.getByRole("button", { name: "Regenerate" }));
        await userEvent.click(await screen.findByRole("button", { name: "Confirm" }));

        await waitFor(() => expect(mockGeneratePrepPlan).toHaveBeenCalledTimes(2));
        expect(mockGeneratePrepPlan).toHaveBeenCalledWith({ branchId: "branch-1" });
        expect(mockGeneratePrepPlan).toHaveBeenCalledWith({ branchId: "branch-2" });

        await waitFor(() => expect(mockFetchCurrentPrepPlan).toHaveBeenCalledWith("branch-1,branch-2"));
    });

    it("surfaces a per-branch generate failure as an error string without losing the other branch's success", async () => {
        mockGeneratePrepPlan.mockImplementation((payload) => {
            if (payload.branchId === "branch-2") {
                return Promise.reject(new Error("network error"));
            }
            return Promise.resolve(plan);
        });

        render(<PrepPlanTable branchIds={["branch-1", "branch-2"]} />);

        await screen.findByText("Regenerate");
        await userEvent.click(screen.getByRole("button", { name: "Regenerate" }));
        await userEvent.click(await screen.findByRole("button", { name: "Confirm" }));

        await waitFor(() => expect(mockGeneratePrepPlan).toHaveBeenCalledTimes(2));
        expect(await screen.findByText(/Failed to generate plan for branch: branch-2/)).toBeTruthy();
        // The plan is still reloaded and rendered despite the one failed branch.
        expect(await screen.findByText("Dough Ball(100%)")).toBeTruthy();
    });
});
