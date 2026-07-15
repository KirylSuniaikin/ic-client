import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PurchaseTablePopup } from "./PurchaseTablePopup";
import {
    fetchProducts,
    fetchVendors,
    getPurchaseReport,
    getUser,
} from "../../../../shared/api/management";
import type { IBranch, ProductTO } from "../../inventory/types";
import type { PurchaseTO } from "../types";

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/management.ts
jest.mock("../../../../shared/api/management");

// Counting stand-in for the real row, memoized exactly like it. Each purchase row carries a
// DatePicker and two Autocompletes, so a row that re-renders when an unrelated row is edited
// is the expensive regression these tests guard. Prefixed `mock*` for the hoisted factory.
const mockRowRenderCounts: Record<string, number> = {};

jest.mock("./PurchaseTableRow", () => {
    const react: typeof React = require("react");
    type MockRowProps = {
        row: { id: string };
        onCommitNumeric: (id: string, field: "quantity" | "finalPrice", raw: string) => void;
    };
    return {
        PurchaseTableRow: react.memo(function MockPurchaseTableRow({ row, onCommitNumeric }: MockRowProps) {
            mockRowRenderCounts[row.id] = (mockRowRenderCounts[row.id] ?? 0) + 1;
            return react.createElement(
                "tr",
                null,
                react.createElement(
                    "td",
                    null,
                    react.createElement(
                        "button",
                        {
                            "data-testid": `commit-${row.id}`,
                            onClick: () => onCommitNumeric(row.id, "quantity", "5"),
                        },
                        row.id,
                    ),
                ),
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

const report: PurchaseTO = {
    id: 7,
    title: "jul-25-bh-admin",
    finalPrice: 0,
    userId: 1,
    purchaseDate: "2026-07-14",
    purchaseProducts: [
        {
            product: makeProduct(1, "Flour"),
            quantity: 1,
            finalPrice: 10,
            price: 10,
            vendorName: "Acme",
            purchaseDate: "2026-07-14",
        },
        {
            product: makeProduct(2, "Cheese"),
            quantity: 2,
            finalPrice: 20,
            price: 10,
            vendorName: "Acme",
            purchaseDate: "2026-07-14",
        },
    ],
};

describe("PurchaseTablePopup row memoization", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        for (const key of Object.keys(mockRowRenderCounts)) {
            delete mockRowRenderCounts[key];
        }
        jest.mocked(fetchProducts).mockResolvedValue([makeProduct(1, "Flour"), makeProduct(2, "Cheese")]);
        jest.mocked(fetchVendors).mockResolvedValue([{ id: 1, vendorName: "Acme" }]);
        jest.mocked(getUser).mockResolvedValue({ id: 1, userName: "admin" });
        jest.mocked(getPurchaseReport).mockResolvedValue(report);
    });

    it("re-renders only the edited row when a value is committed", async () => {
        render(
            <PurchaseTablePopup
                open={true}
                mode="edit"
                purchaseId={7}
                userId={1}
                branch={branch}
                onClose={jest.fn()}
            />
        );

        await screen.findByTestId("commit-r-0");
        expect(mockRowRenderCounts["r-0"]).toBe(1);
        expect(mockRowRenderCounts["r-1"]).toBe(1);

        fireEvent.click(screen.getByTestId("commit-r-0"));

        // The edited row re-renders with its new value; the untouched row's props are
        // unchanged, so it must be skipped.
        await waitFor(() => expect(mockRowRenderCounts["r-0"]).toBe(2));
        expect(mockRowRenderCounts["r-1"]).toBe(1);
    });
});
