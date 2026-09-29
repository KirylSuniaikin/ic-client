import { jest, describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import ShiftDateRangeFields from "./ShiftDateRangeFields";
import type { ShiftDateRange } from "../types";

const AUGUST: ShiftDateRange = { from: "2026-08-01", to: "2026-08-31" };

function renderFields(
    value: ShiftDateRange | null = AUGUST,
    onChange = jest.fn<void, [ShiftDateRange]>(),
): { onChange: typeof onChange; rerender: (value: ShiftDateRange | null) => void } {
    const { rerender } = render(<ShiftDateRangeFields value={value} onChange={onChange} />);
    return {
        onChange,
        rerender: (next) => rerender(<ShiftDateRangeFields value={next} onChange={onChange} />),
    };
}

function input(testId: string): HTMLInputElement {
    return screen.getByTestId(testId).querySelector("input") as HTMLInputElement;
}

describe("ShiftDateRangeFields", () => {
    it("shows the window it is given", () => {
        renderFields();

        expect(input("shift-range-from").value).toBe("2026-08-01");
        expect(input("shift-range-to").value).toBe("2026-08-31");
    });

    it("shows empty fields while the window is unknown", () => {
        renderFields(null);

        expect(input("shift-range-from").value).toBe("");
        expect(input("shift-range-to").value).toBe("");
    });

    // The parent's window changes under it when the month is switched or the report reloads.
    it("re-seeds when the window it is given changes", () => {
        const { rerender } = renderFields();

        rerender({ from: "2026-07-25", to: "2026-08-24" });

        expect(input("shift-range-from").value).toBe("2026-07-25");
        expect(input("shift-range-to").value).toBe("2026-08-24");
    });

    // Callers build `value` inline on every render; an equal window must not wipe a half-entered edit.
    it("keeps an in-progress edit when re-rendered with an equal window", () => {
        const { rerender } = renderFields();

        fireEvent.change(input("shift-range-from"), { target: { value: "2026-09-10" } });
        rerender({ ...AUGUST });

        expect(input("shift-range-from").value).toBe("2026-09-10");
    });

    it("reports a complete, ordered range", () => {
        const { onChange } = renderFields();

        fireEvent.change(input("shift-range-from"), { target: { value: "2026-08-10" } });

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith({ from: "2026-08-10", to: "2026-08-31" });
    });

    // To goes first: an empty From sorts before any To, so only the empty-date check holds it back.
    it("waits for both dates before reporting", () => {
        const { onChange } = renderFields(null);

        fireEvent.change(input("shift-range-to"), { target: { value: "2026-08-15" } });
        expect(onChange).not.toHaveBeenCalled();

        fireEvent.change(input("shift-range-from"), { target: { value: "2026-08-01" } });
        expect(onChange).toHaveBeenCalledWith({ from: "2026-08-01", to: "2026-08-15" });
    });

    it.each(["shift-range-from", "shift-range-to"])("does not report a cleared date (%s)", (testId: string) => {
        const { onChange } = renderFields();

        fireEvent.change(input(testId), { target: { value: "" } });

        expect(onChange).not.toHaveBeenCalled();
    });

    it("flags From after To and does not report it", () => {
        const { onChange } = renderFields();

        fireEvent.change(input("shift-range-from"), { target: { value: "2026-09-05" } });

        expect(onChange).not.toHaveBeenCalled();
        expect(screen.getByText("From must be on or before To")).toBeTruthy();
        expect(input("shift-range-from").getAttribute("aria-invalid")).toBe("true");
        expect(input("shift-range-to").getAttribute("aria-invalid")).toBe("true");
    });

    it("accepts a single-day range", () => {
        const { onChange } = renderFields();

        fireEvent.change(input("shift-range-to"), { target: { value: "2026-08-01" } });

        expect(onChange).toHaveBeenCalledWith({ from: "2026-08-01", to: "2026-08-01" });
        expect(screen.queryByText("From must be on or before To")).toBeNull();
    });

    it("does not report a range equal to the one it was given", () => {
        const { onChange } = renderFields();

        fireEvent.change(input("shift-range-from"), { target: { value: "2026-08-05" } });
        fireEvent.change(input("shift-range-from"), { target: { value: "2026-08-01" } });

        expect(onChange).toHaveBeenCalledTimes(1);
    });

    // Each keystroke in a date segment is a change of its own (a typed year passes through 0002,
    // 0020, 0202), and each report reloads -- so typed edits are held until the field is left.
    it("holds a typed edit until the field loses focus", () => {
        const { onChange } = renderFields();

        fireEvent.keyDown(input("shift-range-from"), { key: "1" });
        fireEvent.change(input("shift-range-from"), { target: { value: "2026-08-10" } });
        expect(onChange).not.toHaveBeenCalled();

        fireEvent.blur(input("shift-range-from"));
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith({ from: "2026-08-10", to: "2026-08-31" });
    });

    it("commits a typed edit on Enter", () => {
        const { onChange } = renderFields();

        fireEvent.keyDown(input("shift-range-to"), { key: "2" });
        fireEvent.change(input("shift-range-to"), { target: { value: "2026-08-20" } });
        fireEvent.keyDown(input("shift-range-to"), { key: "Enter" });

        expect(onChange).toHaveBeenCalledWith({ from: "2026-08-01", to: "2026-08-20" });
    });

    it("does not report when focus leaves without an edit", () => {
        const { onChange } = renderFields();

        fireEvent.keyDown(input("shift-range-from"), { key: "Tab" });
        fireEvent.blur(input("shift-range-from"));

        expect(onChange).not.toHaveBeenCalled();
    });

    it("disables both fields when asked", () => {
        render(<ShiftDateRangeFields value={AUGUST} onChange={jest.fn<void, [ShiftDateRange]>()} disabled />);

        expect(input("shift-range-from").disabled).toBe(true);
        expect(input("shift-range-to").disabled).toBe(true);
    });
});
