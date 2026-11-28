import { describe, it, expect, jest } from "@jest/globals";
import React from "react";
import { render, screen } from "@testing-library/react";
import ComponentCostDrawer from "./ComponentCostDrawer";
import type { ComponentCost } from "../../types";

function component(overrides: Partial<ComponentCost> = {}): ComponentCost {
    return {
        id: 1,
        name: "Pizza sauce",
        unit: "GRAMS",
        productId: null,
        productName: null,
        productPrice: null,
        cost: 1.2,
        batchYield: null,
        ingredients: [],
        resolvedUnitCost: 0.0012,
        costSource: "MANUAL",
        ...overrides,
    };
}

function renderDrawer(components: ComponentCost[]): void {
    render(<ComponentCostDrawer open components={components} onClose={jest.fn()} onChange={jest.fn(async () => undefined)} />);
}

describe("ComponentCostDrawer units", () => {
    it("labels a kitchen component in g / ml / pcs, like the prep plan", () => {
        renderDrawer([
            component({ id: 1, name: "Pizza sauce", unit: "GRAMS" }),
            component({ id: 2, name: "Ranch", unit: "ML" }),
            component({ id: 3, name: "Dough ball", unit: "PIECES" }),
        ]);

        expect(screen.getByText("g")).toBeTruthy();
        expect(screen.getByText("ml")).toBeTruthy();
        expect(screen.getByText("pcs")).toBeTruthy();
        expect(screen.queryByText("grams")).toBeNull();
    });
});
