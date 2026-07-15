import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import InventoryPopup from "./InventoryPopup";
import { fetchProducts } from "../../../../shared/api/management";
import type { IBranch, IUser, ProductTO } from "../types";

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/management.ts
jest.mock("../../../../shared/api/management");

// Counting stand-in for the real row. It is memoized exactly like the real one, so it
// re-renders only when InventoryPopup hands it a prop that changed identity — which is
// what these tests assert. Prefixed `mock*` so the hoisted jest.mock factory may close over it.
const mockRowRenderCounts: Record<number, number> = {};

jest.mock("./InventoryTableRow", () => {
    const react: typeof React = require("react");
    type MockRowProps = { row: { productId: number; name: string } };
    return {
        InventoryTableRow: react.memo(function MockInventoryTableRow({ row }: MockRowProps) {
            mockRowRenderCounts[row.productId] = (mockRowRenderCounts[row.productId] ?? 0) + 1;
            return react.createElement(
                "tr",
                null,
                react.createElement("td", { "data-testid": `row-${row.productId}` }, row.name),
            );
        }),
    };
});

const branch: IBranch = {
    id: "branch-uuid",
    externalId: "ext-1",
    branchNo: 1,
    branchName: "Main",
    locale: "en",
};

const author: IUser = { id: 1, userName: "admin" };

function makeProduct(id: number, name: string): ProductTO {
    return {
        id,
        name,
        targetPrice: 10,
        price: 5,
        isInventory: true,
        isPurchasable: true,
        isBundle: false,
        topVendor: "",
    };
}

describe("InventoryPopup row memoization", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        for (const key of Object.keys(mockRowRenderCounts)) {
            delete mockRowRenderCounts[Number(key)];
        }
        jest.mocked(fetchProducts).mockResolvedValue([
            makeProduct(1, "Mozzarella"),
            makeProduct(2, "Mozzarella Extra"),
        ]);
    });

    it("does not re-render rows while typing in the name filter", async () => {
        render(
            <InventoryPopup
                open={true}
                mode="new"
                branch={branch}
                author={author}
                onClose={jest.fn()}
            />
        );

        await screen.findByTestId("row-1");
        expect(mockRowRenderCounts[1]).toBe(1);
        expect(mockRowRenderCounts[2]).toBe(1);

        // Both products still match, so both rows stay mounted — and their props are unchanged,
        // so a memoized row must not re-render on any of these keystrokes.
        const filter = screen.getByPlaceholderText("Type to filter");
        fireEvent.change(filter, { target: { value: "m" } });
        fireEvent.change(filter, { target: { value: "mo" } });
        fireEvent.change(filter, { target: { value: "moz" } });

        expect(screen.getByTestId("row-1")).toBeTruthy();
        expect(screen.getByTestId("row-2")).toBeTruthy();
        expect(mockRowRenderCounts[1]).toBe(1);
        expect(mockRowRenderCounts[2]).toBe(1);
    });
});
