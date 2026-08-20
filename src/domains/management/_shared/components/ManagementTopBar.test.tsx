import { jest, describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ManagementTopBar } from "./ManagementTopBar";

describe("ManagementTopBar", () => {
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
        it("renders the branchSelector node when provided", () => {
            render(<ManagementTopBar title="Orders" branchSelector={<button>Branch Picker</button>} />);

            expect(screen.getByText("Branch Picker")).toBeTruthy();
        });

        it("does not render anything for the branchSelector slot when null", () => {
            render(<ManagementTopBar title="Orders" branchSelector={null} />);

            expect(screen.queryByText("Branch Picker")).toBeNull();
        });

        it("does not render anything for the branchSelector slot when omitted", () => {
            render(<ManagementTopBar title="Orders" />);

            expect(screen.queryByText("Branch Picker")).toBeNull();
        });

        it("renders the branchSelector node in the right-aligned slot before actions", () => {
            render(
                <ManagementTopBar
                    title="Orders"
                    branchSelector={<button data-testid="branch-selector">Branch Picker</button>}
                    actions={<button data-testid="export-action">Export</button>}
                />
            );

            const selector = screen.getByTestId("branch-selector");
            const action = screen.getByTestId("export-action");

            // DOCUMENT_POSITION_FOLLOWING means `action` comes after `selector` in the DOM,
            // i.e. branchSelector is placed before actions in the right-aligned Toolbar slot.
            // eslint-disable-next-line no-bitwise
            expect(selector.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        });

        it("places both the branchSelector and actions after the flex spacer, i.e. right-aligned in the toolbar", () => {
            const { container } = render(
                <ManagementTopBar
                    title="Orders"
                    branchSelector={<button data-testid="branch-selector">Branch Picker</button>}
                    actions={<button data-testid="export-action">Export</button>}
                />
            );

            const toolbar = container.querySelector('[class*="MuiToolbar-root"]');
            expect(toolbar).not.toBeNull();

            const children = Array.from(toolbar?.children ?? []);
            const selectorIndex = children.findIndex(el => el.contains(screen.getByTestId("branch-selector")));
            const actionIndex = children.findIndex(el => el.contains(screen.getByTestId("export-action")));
            const titleIndex = children.findIndex(el => el.textContent === "Orders");

            expect(selectorIndex).toBeGreaterThan(titleIndex);
            expect(actionIndex).toBeGreaterThan(selectorIndex);
        });
    });
});
