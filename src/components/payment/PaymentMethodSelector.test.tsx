import { describe, it, expect, jest } from "@jest/globals";
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, createTheme } from "@mui/material";
import PaymentMethodSelector, { PaymentMethod } from "./PaymentMethodSelector";

const theme = createTheme();

function renderSelector(value: PaymentMethod | null, onChange: (m: PaymentMethod) => void): void {
    render(
        <ThemeProvider theme={theme}>
            <PaymentMethodSelector value={value} onChange={onChange} />
        </ThemeProvider>
    );
}

describe("PaymentMethodSelector", () => {
    describe("when value is null", () => {
        it("should render all four option titles in the DOM", () => {
            // Arrange
            const onChange = jest.fn<void, [PaymentMethod]>();

            // Act
            renderSelector(null, onChange);

            // Assert
            expect(screen.getByText("Cash")).not.toBeNull();
            expect(screen.getByText("Card")).not.toBeNull();
            expect(screen.getByText("Benefit")).not.toBeNull();
            expect(screen.getByText("Credimax")).not.toBeNull();
        });

        it("should render no card in selected state when value is null", () => {
            // Arrange
            const onChange = jest.fn<void, [PaymentMethod]>();

            // Act
            renderSelector(null, onChange);

            // Assert — aria-pressed reflects each card's selected state.
            const cashBtn = screen.getByText("Cash").closest("button");
            const cardBtn = screen.getByText("Card").closest("button");
            const benefitBtn = screen.getByText("Benefit").closest("button");
            const credimaxBtn = screen.getByText("Credimax").closest("button");
            expect(cashBtn?.getAttribute("aria-pressed")).toBe("false");
            expect(cardBtn?.getAttribute("aria-pressed")).toBe("false");
            expect(benefitBtn?.getAttribute("aria-pressed")).toBe("false");
            expect(credimaxBtn?.getAttribute("aria-pressed")).toBe("false");
        });
    });

    describe("when a card is clicked", () => {
        it("should call onChange with the correct PaymentMethod", async () => {
            // Arrange
            const onChange = jest.fn<void, [PaymentMethod]>();
            renderSelector(null, onChange);

            // Act
            await userEvent.click(screen.getByText("Cash"));

            // Assert
            expect(onChange).toHaveBeenCalledTimes(1);
            expect(onChange).toHaveBeenCalledWith("Cash");
        });
    });

    describe("when value matches a card", () => {
        it("should show only the matching card as selected", () => {
            // Arrange
            const onChange = jest.fn<void, [PaymentMethod]>();

            // Act
            renderSelector("Benefit", onChange);

            // Assert — the Benefit card has aria-pressed="true"; all other cards have aria-pressed="false".
            const benefitButton = screen.getByText("Benefit").closest("button");
            const cashButton = screen.getByText("Cash").closest("button");
            const cardButton = screen.getByText("Card").closest("button");
            const credimaxButton = screen.getByText("Credimax").closest("button");
            expect(benefitButton?.getAttribute("aria-pressed")).toBe("true");
            expect(cashButton?.getAttribute("aria-pressed")).toBe("false");
            expect(cardButton?.getAttribute("aria-pressed")).toBe("false");
            expect(credimaxButton?.getAttribute("aria-pressed")).toBe("false");
        });
    });
});
