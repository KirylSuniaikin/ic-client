import { jest, describe, it, expect } from "@jest/globals";
import React from "react";
import { act, render, screen, fireEvent } from "@testing-library/react";
import { DecimalCellInput } from "./DecimalCellInput";

describe("DecimalCellInput", () => {
    it("does not notify the parent while typing — only on blur", () => {
        const onCommit = jest.fn<void, [string]>();
        render(<DecimalCellInput value="" onCommit={onCommit} />);
        const input = screen.getByPlaceholderText("0.000");

        fireEvent.focus(input);
        fireEvent.change(input, { target: { value: "1" } });
        fireEvent.change(input, { target: { value: "1.2" } });
        fireEvent.change(input, { target: { value: "1.25" } });

        expect(onCommit).not.toHaveBeenCalled();
        expect((input as HTMLInputElement).value).toBe("1.25");

        fireEvent.blur(input);

        expect(onCommit).toHaveBeenCalledTimes(1);
        expect(onCommit).toHaveBeenCalledWith("1.25");
    });

    it("shows the committed value from props once the edit ends", () => {
        const { rerender } = render(<DecimalCellInput value="" onCommit={jest.fn()} />);
        const input = screen.getByPlaceholderText("0.000");

        fireEvent.focus(input);
        fireEvent.change(input, { target: { value: "3" } });
        fireEvent.blur(input);

        rerender(<DecimalCellInput value="3.000" onCommit={jest.fn()} />);

        expect((input as HTMLInputElement).value).toBe("3.000");
    });

    it("commits an empty string when a cell is blurred without being typed into", () => {
        const onCommit = jest.fn<void, [string]>();
        render(<DecimalCellInput value="" onCommit={onCommit} />);
        const input = screen.getByPlaceholderText("0.000");

        fireEvent.blur(input);

        expect(onCommit).toHaveBeenCalledWith("");
    });

    it("clears a zero value on focus when clearZeroOnFocus is set, so it can be typed over", () => {
        render(<DecimalCellInput value="0.000" onCommit={jest.fn()} clearZeroOnFocus />);
        const input = screen.getByPlaceholderText("0.000");

        fireEvent.focus(input);

        expect((input as HTMLInputElement).value).toBe("");
    });

    it("keeps a non-zero value on focus when clearZeroOnFocus is set", () => {
        render(<DecimalCellInput value="2.500" onCommit={jest.fn()} clearZeroOnFocus />);
        const input = screen.getByPlaceholderText("0.000");

        fireEvent.focus(input);

        expect((input as HTMLInputElement).value).toBe("2.500");
    });

    it("keeps a zero value on focus by default", () => {
        render(<DecimalCellInput value="0.000" onCommit={jest.fn()} />);
        const input = screen.getByPlaceholderText("0.000");

        fireEvent.focus(input);

        expect((input as HTMLInputElement).value).toBe("0.000");
    });

    it("commits an untouched value on blur by default", () => {
        // Inventory and purchases rely on this; the optional props below must not change it.
        const onCommit = jest.fn<void, [string]>();
        render(<DecimalCellInput value="2.500" onCommit={onCommit} />);
        const input = screen.getByPlaceholderText("0.000");

        fireEvent.focus(input);
        fireEvent.blur(input);

        expect(onCommit).toHaveBeenCalledWith("2.500");
    });

    it("selects the whole figure on focus when selectOnFocus is set, so typing replaces it", () => {
        render(<DecimalCellInput value="1741.080" selectOnFocus onCommit={jest.fn()} />);
        const input = screen.getByPlaceholderText("0.000") as HTMLInputElement;

        fireEvent.focus(input);

        expect(input.selectionStart).toBe(0);
        expect(input.selectionEnd).toBe("1741.080".length);
    });

    it("stops the mouseup of a focusing click from undoing the selection", () => {
        // Chrome places the caret on that mouseup, which silently cancels the select-all.
        render(<DecimalCellInput value="5" selectOnFocus onCommit={jest.fn()} />);
        const input = screen.getByPlaceholderText("0.000");

        fireEvent.mouseDown(input);
        fireEvent.focus(input);
        const mouseUpWentThrough = fireEvent.mouseUp(input);

        expect(mouseUpWentThrough).toBe(false);
    });

    it("leaves a mouseup alone when the input was already focused", () => {
        // Otherwise a second click could never place the caret.
        render(<DecimalCellInput value="5" selectOnFocus onCommit={jest.fn()} />);
        const input = screen.getByPlaceholderText("0.000");
        act(() => input.focus());

        fireEvent.mouseDown(input);
        const mouseUpWentThrough = fireEvent.mouseUp(input);

        expect(mouseUpWentThrough).toBe(true);
    });

    it("discards the draft on Escape and does not commit when cancelOnEscape is set", () => {
        const onCommit = jest.fn<void, [string]>();
        render(<DecimalCellInput value="5" cancelOnEscape onCommit={onCommit} />);
        const input = screen.getByPlaceholderText("0.000") as HTMLInputElement;
        act(() => input.focus());

        fireEvent.change(input, { target: { value: "999" } });
        fireEvent.keyDown(input, { key: "Escape" });

        expect(onCommit).not.toHaveBeenCalled();
        expect(document.activeElement).not.toBe(input);
        expect(input.value).toBe("5");
    });

    it("does not commit a cell nobody typed into when commitOnlyIfEdited is set", () => {
        const onCommit = jest.fn<void, [string]>();
        render(<DecimalCellInput value="5" commitOnlyIfEdited onCommit={onCommit} />);
        const input = screen.getByPlaceholderText("0.000");

        fireEvent.focus(input);
        fireEvent.blur(input);
        expect(onCommit).not.toHaveBeenCalled();

        fireEvent.focus(input);
        fireEvent.change(input, { target: { value: "6" } });
        fireEvent.blur(input);
        expect(onCommit).toHaveBeenCalledWith("6");
    });

    it("passes inputProps to the input itself", () => {
        render(<DecimalCellInput value="5" onCommit={jest.fn()}
                                 inputProps={{ "aria-label": "orders Talabat", "data-field": "orders" }} />);

        expect(screen.getByLabelText("orders Talabat").getAttribute("data-field")).toBe("orders");
    });
});
