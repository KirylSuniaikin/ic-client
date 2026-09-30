import { jest, describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { SortDirButtons } from "./SortDirButtons";
import { MultiSelectFilterPopover } from "./MultiSelectFilterPopover";
import { TextFilterPopover } from "./TextFilterPopover";

describe("SortDirButtons", () => {
    it("reports the direction clicked, including re-clicking the active one", () => {
        const onSelect = jest.fn();
        render(<SortDirButtons dir="asc" onSelect={onSelect} />);

        fireEvent.click(screen.getByTestId("sort-desc"));
        fireEvent.click(screen.getByTestId("sort-asc"));

        expect(onSelect).toHaveBeenNthCalledWith(1, "desc");
        expect(onSelect).toHaveBeenNthCalledWith(2, "asc");
    });

    it("marks only the active direction as selected", () => {
        render(<SortDirButtons dir="desc" onSelect={jest.fn()} />);
        expect(screen.getByTestId("sort-desc").getAttribute("aria-pressed")).toBe("true");
        expect(screen.getByTestId("sort-asc").getAttribute("aria-pressed")).toBe("false");
    });
});

describe("filter popovers with a sort section", () => {
    const anchor = document.createElement("button");
    document.body.appendChild(anchor);

    it("the multiselect popover shows the sort buttons only when given a sort", () => {
        const base = { open: true, anchorEl: anchor, onClose: jest.fn(), options: [], selected: [], onToggle: jest.fn() };
        const { rerender } = render(<MultiSelectFilterPopover {...base} />);
        expect(screen.queryByTestId("sort-asc")).toBeNull();

        const onSelect = jest.fn();
        rerender(<MultiSelectFilterPopover {...base} sort={{ dir: null, onSelect }} />);
        fireEvent.click(screen.getByTestId("sort-asc"));
        expect(onSelect).toHaveBeenCalledWith("asc");
    });

    it("the text popover shows the sort buttons only when given a sort", () => {
        const base = { open: true, anchorEl: anchor, onClose: jest.fn(), value: "", onChange: jest.fn(), ariaLabel: "x" };
        const { rerender } = render(<TextFilterPopover {...base} />);
        expect(screen.queryByTestId("sort-desc")).toBeNull();

        const onSelect = jest.fn();
        rerender(<TextFilterPopover {...base} sort={{ dir: null, onSelect }} />);
        fireEvent.click(screen.getByTestId("sort-desc"));
        expect(onSelect).toHaveBeenCalledWith("desc");
    });
});
