import { describe, it, expect } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import ScoreBadge from "./ScoreBadge";

describe("ScoreBadge", () => {
    it("renders a negative score with its zone and aria-label", () => {
        render(<ScoreBadge score={-12} zone="RED" testId="b" />);

        const el = screen.getByTestId("b");
        expect(el.textContent).toBe("-12");
        expect(el.getAttribute("data-zone")).toBe("RED");
        expect(el.getAttribute("aria-label")).toBe("Score -12, Red zone");
    });

    it("renders a three-digit score", () => {
        render(<ScoreBadge score={100} zone="GREEN" testId="b" />);

        const el = screen.getByTestId("b");
        expect(el.textContent).toBe("100");
        expect(el.getAttribute("data-zone")).toBe("GREEN");
        expect(el.getAttribute("aria-label")).toBe("Score 100, Green zone");
    });

    it("is 22px by default and 56px when large", () => {
        const { rerender } = render(<ScoreBadge score={5} zone="YELLOW" testId="b" />);
        expect(getComputedStyle(screen.getByTestId("b")).width).toBe("22px");
        expect(getComputedStyle(screen.getByTestId("b")).height).toBe("22px");

        rerender(<ScoreBadge score={5} zone="YELLOW" size="md" testId="b" />);
        expect(getComputedStyle(screen.getByTestId("b")).width).toBe("30px");
        rerender(<ScoreBadge score={5} zone="YELLOW" size="lg" testId="b" />);
        expect(getComputedStyle(screen.getByTestId("b")).width).toBe("56px");
        expect(getComputedStyle(screen.getByTestId("b")).height).toBe("56px");
    });
});
