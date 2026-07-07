import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ManagementTopBar } from "./ManagementTopBar";
import { fetchAllBranches } from "../../../../shared/api/management";
import type { IBranch } from "../../inventory/types";

jest.mock("../../../../shared/api/management");

const mockBranch: IBranch = { id: "1", externalId: "ext-1", branchNo: 1, branchName: "Test Branch", locale: "en" };

describe("ManagementTopBar", () => {
    beforeEach(() => {
        jest.mocked(fetchAllBranches).mockResolvedValue([mockBranch]);
    });

    describe("title prop", () => {
        it("renders the title text", () => {
            render(<ManagementTopBar title="Inventory" />);

            expect(screen.getByText("Inventory")).toBeTruthy();
        });

        it("renders a different title text", () => {
            render(<ManagementTopBar title="Shift Report" />);

            expect(screen.getByText("Shift Report")).toBeTruthy();
        });
    });

    describe("onBack prop", () => {
        it("does not render a back button when onBack is omitted", () => {
            render(<ManagementTopBar title="Orders" />);

            expect(screen.queryByRole("button", { name: /back/i })).toBeNull();
        });

        it("renders a back button when onBack is provided", () => {
            render(<ManagementTopBar title="Orders" onBack={jest.fn()} />);

            expect(screen.getByRole("button", { name: /back/i })).toBeTruthy();
        });

        it("calls onBack when the back button is clicked", () => {
            const onBack = jest.fn<void, []>();
            render(<ManagementTopBar title="Orders" onBack={onBack} />);

            fireEvent.click(screen.getByRole("button", { name: /back/i }));

            expect(onBack).toHaveBeenCalledTimes(1);
        });
    });

    describe("actions prop", () => {
        it("renders actions when provided", () => {
            render(
                <ManagementTopBar
                    title="Stats"
                    actions={<button>Export</button>}
                />
            );

            expect(screen.getByText("Export")).toBeTruthy();
        });

        it("renders multiple action elements when provided", () => {
            render(
                <ManagementTopBar
                    title="Stats"
                    actions={
                        <>
                            <button>Export</button>
                            <button>Filter</button>
                        </>
                    }
                />
            );

            expect(screen.getByText("Export")).toBeTruthy();
            expect(screen.getByText("Filter")).toBeTruthy();
        });

        it("renders without error when actions prop is omitted", () => {
            expect(() =>
                render(<ManagementTopBar title="Purchases" />)
            ).not.toThrow();
        });
    });

    describe("branchSelector prop", () => {
        it("renders BranchSelectorComponent when branchSelector=true", async () => {
            render(<ManagementTopBar title="Orders" branchSelector={true} />);

            await waitFor(() => {
                expect(screen.getByRole("combobox")).toBeTruthy();
            });
        });

        it("does not render BranchSelectorComponent when branchSelector=false", () => {
            render(<ManagementTopBar title="Orders" branchSelector={false} />);

            expect(screen.queryByRole("combobox")).toBeNull();
        });

        it("does not render BranchSelectorComponent when branchSelector is omitted", () => {
            render(<ManagementTopBar title="Orders" />);

            expect(screen.queryByRole("combobox")).toBeNull();
        });
    });
});
