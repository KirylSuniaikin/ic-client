import { describe, it, expect } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import { FaqSection } from "./FaqSection";

const ITEMS = [
    { question: "Do you deliver?", answer: "Yes, via Talabat and Keeta." },
    { question: "Do you take card?", answer: "Yes." },
];

describe("FaqSection", () => {
    it("renders every question and answer", () => {
        render(<FaqSection items={ITEMS} />);

        ITEMS.forEach(item => {
            expect(screen.getByText(item.question)).toBeTruthy();
            expect(screen.getByText(item.answer)).toBeTruthy();
        });
    });

    it("renders the section heading", () => {
        render(<FaqSection items={ITEMS} />);
        expect(screen.getByText("Frequently Asked Questions")).toBeTruthy();
    });

    it("renders nothing extra for an empty list", () => {
        render(<FaqSection items={[]} />);
        expect(screen.getByText("Frequently Asked Questions")).toBeTruthy();
        expect(screen.queryByText("Do you deliver?")).toBeNull();
    });
});
