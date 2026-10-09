import { jest, describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import CatalogPicker from "./CatalogPicker";
import { makeCategory, makeItem } from "../testFixtures";
import type { CatalogCategoryTO } from "../types";

function categories(): CatalogCategoryTO[] {
    return [
        { ...makeCategory(1, [makeItem(11, "A", 1), makeItem(12, "D", 1)]), code: "4", name: "Attendance", correctiveMeasure: "Verbal reminder first" },
        makeCategory(2, [makeItem(21, "B", 2)]),
        makeCategory(3, [makeItem(31, "D", 3)]),
    ];
}

describe("CatalogPicker", () => {
    it("lists each category collapsed with a '{code} · {name}' header", () => {
        render(<CatalogPicker categories={categories()} value={null} onChange={jest.fn()} canIssueClassD />);

        expect(screen.getByTestId("catalog-category-1").textContent).toBe("4 · Attendance");
        expect(screen.getByTestId("catalog-category-2").textContent).toBe("2 · Cat 2");
        expect(screen.queryByTestId("catalog-item-11")).toBeNull();
    });

    it("shows the corrective-measure line and item rows when a category is expanded", () => {
        render(<CatalogPicker categories={categories()} value={null} onChange={jest.fn()} canIssueClassD />);

        fireEvent.click(screen.getByTestId("catalog-category-1"));

        expect(screen.getByTestId("catalog-measure-1").textContent).toBe("Verbal reminder first");
        const row = screen.getByTestId("catalog-item-11").textContent ?? "";
        expect(row).toContain("c.11 Item 11");
        expect(row).toContain("Class A");
        expect(row).toContain("Points: -1");
    });

    it("omits the corrective-measure line when the category has none", () => {
        render(<CatalogPicker categories={categories()} value={null} onChange={jest.fn()} canIssueClassD />);

        fireEvent.click(screen.getByTestId("catalog-category-2"));

        expect(screen.queryByTestId("catalog-measure-2")).toBeNull();
    });

    it("collapses an expanded category when its header is clicked again", () => {
        render(<CatalogPicker categories={categories()} value={null} onChange={jest.fn()} canIssueClassD />);

        fireEvent.click(screen.getByTestId("catalog-category-2"));
        fireEvent.click(screen.getByTestId("catalog-category-2"));

        expect(screen.queryByTestId("catalog-item-21")).toBeNull();
    });

    it("shows class D rows as 'Class D' with no points and never shows hours", () => {
        render(<CatalogPicker categories={categories()} value={null} onChange={jest.fn()} canIssueClassD />);

        fireEvent.click(screen.getByTestId("catalog-category-1"));

        const d = screen.getByTestId("catalog-item-12").textContent ?? "";
        expect(d).toContain("Class D");
        expect(d).not.toContain("Points");
        expect(screen.queryByText(/hour/i)).toBeNull();
    });

    it("shows class D entries when the issuer may issue them", () => {
        render(<CatalogPicker categories={categories()} value={null} onChange={jest.fn()} canIssueClassD />);

        fireEvent.click(screen.getByTestId("catalog-category-3"));

        expect(screen.getByTestId("catalog-item-31")).toBeTruthy();
    });

    it("hides class D entries, and categories left empty by that, from a MANAGER", () => {
        render(<CatalogPicker categories={categories()} value={null} onChange={jest.fn()} canIssueClassD={false} />);

        expect(screen.queryByTestId("catalog-category-3")).toBeNull();
        fireEvent.click(screen.getByTestId("catalog-category-1"));
        expect(screen.getByTestId("catalog-item-11")).toBeTruthy();
        expect(screen.queryByTestId("catalog-item-12")).toBeNull();
    });

    it("calls onChange with the item id and marks the selected value", () => {
        const onChange = jest.fn();
        const { rerender } = render(<CatalogPicker categories={categories()} value={null} onChange={onChange} canIssueClassD />);
        fireEvent.click(screen.getByTestId("catalog-category-2"));

        fireEvent.click(screen.getByTestId("catalog-item-21"));

        expect(onChange).toHaveBeenCalledWith(21);
        rerender(<CatalogPicker categories={categories()} value={21} onChange={onChange} canIssueClassD />);
        expect(screen.getByTestId("catalog-item-21").getAttribute("aria-checked")).toBe("true");
    });
});
