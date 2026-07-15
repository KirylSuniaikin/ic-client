import { jest, describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
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
});
