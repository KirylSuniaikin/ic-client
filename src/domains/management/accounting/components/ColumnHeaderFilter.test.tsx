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
    it("fires onSort from the label and does not open the popover", () => {
        const { onSort } = renderHeader();

        fireEvent.click(screen.getByTestId("header-sort-note"));

        expect(onSort).toHaveBeenCalledTimes(1);
        expect(screen.queryByTestId("popover-body")).toBeNull();
    });

    it("opens the popover from the icon and does not sort", () => {
        const { onSort } = renderHeader();

        fireEvent.click(screen.getByTestId("header-filter-note"));

        expect(onSort).not.toHaveBeenCalled();
        expect(screen.getByTestId("popover-body")).toBeTruthy();
    });

    it("highlights the icon only while the filter is active", () => {
        renderHeader(UNSORTED, true);
        expect(screen.getByTestId("header-filter-note").getAttribute("data-active")).toBe("true");
    });

    it("leaves the icon neutral while the filter is inactive", () => {
        renderHeader(UNSORTED, false);
        expect(screen.getByTestId("header-filter-note").getAttribute("data-active")).toBe("false");
    });

    it("shows the priority badge only when asked to", () => {
        renderHeader({ dir: "asc", priority: 2, showBadge: true });
        expect(screen.getByTestId("header-sort-note-badge").textContent).toBe("2");
    });

    it("hides the badge for a single sort", () => {
        renderHeader({ dir: "asc", priority: 1, showBadge: false });
        expect(screen.queryByTestId("header-sort-note-badge")).toBeNull();
    });

    it("renders no filter icon when the column has no filter", () => {
        render(<ColumnHeaderFilter label="Date" testId="header-sort-date" sortState={UNSORTED} onSort={jest.fn()} />);
        expect(screen.queryByRole("button", { name: /filter/i })).toBeNull();
    });
});
