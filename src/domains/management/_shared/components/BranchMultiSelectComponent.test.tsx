import { jest, describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BranchMultiSelectComponent } from "./BranchMultiSelectComponent";
import type { IBranch } from "../../inventory/types";

const branchA: IBranch = { id: "a", externalId: "ext-a", branchNo: 1, branchName: "Branch A", locale: "en" };
const branchB: IBranch = { id: "b", externalId: "ext-b", branchNo: 2, branchName: "Branch B", locale: "en" };

describe("BranchMultiSelectComponent", () => {
    describe("renderValue", () => {
        it("shows the single branch name when exactly one branch is selected", () => {
            render(
                <BranchMultiSelectComponent branches={[branchA, branchB]} selected={[branchA]} onSelectedChange={jest.fn()} />
            );

            expect(screen.getByText("Branch A")).toBeTruthy();
        });

        it('shows "N branches" when a strict subset (more than one) of branches is selected', () => {
            const branchC: IBranch = { id: "c", externalId: "ext-c", branchNo: 3, branchName: "Branch C", locale: "en" };
            render(
                <BranchMultiSelectComponent
                    branches={[branchA, branchB, branchC]}
                    selected={[branchA, branchB]}
                    onSelectedChange={jest.fn()}
                />
            );

            expect(screen.getByText("2 branches")).toBeTruthy();
        });

        it('shows "All branches" when every branch is selected', () => {
            render(
                <BranchMultiSelectComponent
                    branches={[branchA, branchB]}
                    selected={[branchA, branchB]}
                    onSelectedChange={jest.fn()}
                />
            );

            expect(screen.getByText("All branches")).toBeTruthy();
        });
    });

    describe("empty-selection guard", () => {
        it("does not call onSelectedChange when re-selecting the only remaining selected branch (would empty the selection)", async () => {
            const onSelectedChange = jest.fn();
            render(
                <BranchMultiSelectComponent branches={[branchA, branchB]} selected={[branchA]} onSelectedChange={onSelectedChange} />
            );

            await userEvent.click(screen.getByRole("combobox"));
            await userEvent.click(within(screen.getByRole("listbox")).getByText("Branch A"));

            expect(onSelectedChange).not.toHaveBeenCalled();
        });

        it("calls onSelectedChange with the added branch when selecting a second branch", async () => {
            const onSelectedChange = jest.fn();
            render(
                <BranchMultiSelectComponent branches={[branchA, branchB]} selected={[branchA]} onSelectedChange={onSelectedChange} />
            );

            await userEvent.click(screen.getByRole("combobox"));
            await userEvent.click(within(screen.getByRole("listbox")).getByText("Branch B"));

            expect(onSelectedChange).toHaveBeenCalledWith([branchA, branchB]);
        });

        it("calls onSelectedChange with the remaining branch when deselecting one of two selected branches", async () => {
            const onSelectedChange = jest.fn();
            render(
                <BranchMultiSelectComponent branches={[branchA, branchB]} selected={[branchA, branchB]} onSelectedChange={onSelectedChange} />
            );

            await userEvent.click(screen.getByRole("combobox"));
            await userEvent.click(within(screen.getByRole("listbox")).getByText("Branch A"));

            expect(onSelectedChange).toHaveBeenCalledWith([branchB]);
        });
    });
});
