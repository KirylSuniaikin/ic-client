import { jest, describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MultiSelectFilterPopover } from "./MultiSelectFilterPopover";

const OPTIONS = [
    { value: "CASH", label: "Cash" },
    { value: "DEBIT_CARD", label: "Debit Card" },
    { value: "NONE", label: "None" },
];

function renderPopover(selected: string[] = [], searchable = false) {
    const onToggle = jest.fn();
    // The popover needs a real anchor node to open.
    const anchor = document.createElement("button");
    document.body.appendChild(anchor);
    render(
        <MultiSelectFilterPopover
            open
            anchorEl={anchor}
            onClose={jest.fn()}
            options={OPTIONS}
            selected={selected}
            onToggle={onToggle}
            searchable={searchable}
        />
    );
    return { onToggle };
}

describe("MultiSelectFilterPopover", () => {
    it("reports the toggled value", () => {
        const { onToggle } = renderPopover();

        fireEvent.click(screen.getByRole("checkbox", { name: "Debit Card" }));

        expect(onToggle).toHaveBeenCalledWith("DEBIT_CARD");
    });

    it("reflects the selection, including the None entry", () => {
        renderPopover(["NONE"]);

        expect((screen.getByRole("checkbox", { name: "None" }) as HTMLInputElement).checked).toBe(true);
        expect((screen.getByRole("checkbox", { name: "Cash" }) as HTMLInputElement).checked).toBe(false);
    });

    it("has no search box unless searchable", () => {
        renderPopover();
        expect(screen.queryByLabelText("Search options")).toBeNull();
    });

    it("narrows the listed options with the search box without touching the selection", () => {
        const { onToggle } = renderPopover(["CASH"], true);

        fireEvent.change(screen.getByLabelText("Search options"), { target: { value: "debit" } });

        expect(screen.queryByRole("checkbox", { name: "Cash" })).toBeNull();
        expect(screen.getByRole("checkbox", { name: "Debit Card" })).toBeTruthy();
        expect(onToggle).not.toHaveBeenCalled();

        fireEvent.change(screen.getByLabelText("Search options"), { target: { value: "" } });
        expect((screen.getByRole("checkbox", { name: "Cash" }) as HTMLInputElement).checked).toBe(true);
    });

    it("says so when the search matches nothing", () => {
        renderPopover([], true);
        fireEvent.change(screen.getByLabelText("Search options"), { target: { value: "zzz" } });
        expect(screen.getByText("No matches")).toBeTruthy();
    });
});
