import { jest, describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ColumnHeaderFilter } from "./ColumnHeaderFilter";
import type { HeaderSortState } from "./ColumnHeaderFilter";

const UNSORTED: HeaderSortState = { dir: null, priority: null, showBadge: false };

function renderHeader(sortState: HeaderSortState = UNSORTED, active = false) {
    const onSort = jest.fn();
    render(
        <ColumnHeaderFilter
            label="Description"
            testId="header-sort-note"
            sortState={sortState}
            onSort={onSort}
            filter={{
                active,
                ariaLabel: "Filter description",
                testId: "header-filter-note",
                children: ({ open }) => (open ? <div data-testid="popover-body">body</div> : null),
            }}
        />
    );
    return { onSort };
}

describe("ColumnHeaderFilter", () => {
    it("opens the popover from the label of a filterable column and does not sort", () => {
        const { onSort } = renderHeader();

        fireEvent.click(screen.getByRole("button", { name: "Filter description" }));

        expect(onSort).not.toHaveBeenCalled();
        expect(screen.getByTestId("popover-body")).toBeTruthy();
    });

    it("has a single click target for a filterable column", () => {
        renderHeader();
        expect(screen.getAllByRole("button")).toHaveLength(1);
    });

    it("highlights the label while the filter is active", () => {
        renderHeader(UNSORTED, true);
        expect(screen.getByTestId("header-filter-note").getAttribute("data-active")).toBe("true");
    });

    it("leaves the label neutral while the filter is inactive and nothing is sorted", () => {
        renderHeader(UNSORTED, false);
        expect(screen.getByTestId("header-filter-note").getAttribute("data-active")).toBe("false");
    });

    it("shows the sort arrow on a filterable column that is sorted", () => {
        renderHeader({ dir: "asc", priority: 1, showBadge: false });
        expect(screen.getByTestId("ArrowUpwardRoundedIcon")).toBeTruthy();
    });

    it("shows the priority badge only when asked to", () => {
        renderHeader({ dir: "asc", priority: 2, showBadge: true });
        expect(screen.getByTestId("header-sort-note-badge").textContent).toBe("2");
    });

    it("hides the badge for a single sort", () => {
        renderHeader({ dir: "asc", priority: 1, showBadge: false });
        expect(screen.queryByTestId("header-sort-note-badge")).toBeNull();
    });

    it("sorts on click for a column with no filter", () => {
        const onSort = jest.fn();
        render(<ColumnHeaderFilter label="Date" testId="header-sort-date" sortState={UNSORTED} onSort={onSort} />);

        fireEvent.click(screen.getByTestId("header-sort-date"));

        expect(onSort).toHaveBeenCalledTimes(1);
    });
});
