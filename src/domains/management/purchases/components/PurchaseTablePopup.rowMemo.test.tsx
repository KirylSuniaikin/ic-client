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
import { StaffRoles } from "../../../auth/types";

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/management.ts
jest.mock("../../../../shared/api/management");

// The role decides whether lines get the create-product callback at all; a manager's lines do,
// and that callback must be as stable as the others or it breaks every row memo at once.
type AuthValue = { role: StaffRoles | null };
const mockUseAuth = jest.fn<AuthValue, []>();
jest.mock("../../../auth/context/AuthProvider", () => ({
    useAuth: () => mockUseAuth(),
}));

// Counting stand-in for the real row, memoized exactly like it. A line that re-renders when an
// unrelated line is edited is the expensive regression these tests guard — and nesting lines
// inside invoices is exactly the change that could have reintroduced it.
// Prefixed `mock*` for the hoisted factory.
const mockRowRenderCounts: Record<string, number> = {};
const mockRowCanCreateProduct: Record<string, boolean> = {};

jest.mock("./PurchaseTableRow", () => {
    const react: typeof React = require("react");
    type MockRowProps = {
        row: { id: string };
        onCommitNumeric: (id: string, field: "quantity" | "finalPrice", raw: string) => void;
        onRequestCreateProduct?: (id: string, name: string) => void;
    };
    return {
        PurchaseTableRow: react.memo(function MockPurchaseTableRow({ row, onCommitNumeric, onRequestCreateProduct }: MockRowProps) {
            mockRowRenderCounts[row.id] = (mockRowRenderCounts[row.id] ?? 0) + 1;
            mockRowCanCreateProduct[row.id] = typeof onRequestCreateProduct === "function";
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

// One invoice, two lines — so this isolates line-level memoization from invoice-level.
const report: PurchaseTO = {
    id: 7,
    title: "jul-25-bh-admin",
    finalPrice: 0,
    userId: 1,
    purchaseDate: "2026-07-14",
    invoices: [
        {
            id: 1,
            invoiceDate: "2026-07-14",
            vendorName: "Acme",
            paid: false,
            finalPrice: 30,
            hasImage: false,
            products: [
                { product: makeProduct(1, "Flour"), quantity: 1, finalPrice: 10, price: 10 },
                { product: makeProduct(2, "Cheese"), quantity: 2, finalPrice: 20, price: 10 },
                { product: makeProduct(3, "Tomato"), quantity: 3, finalPrice: 30, price: 10 },
            ],
        },
    ],
};

describe("PurchaseTablePopup row memoization", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        for (const key of Object.keys(mockRowRenderCounts)) {
            delete mockRowRenderCounts[key];
        }
        mockUseAuth.mockReturnValue({ role: null });
        jest.mocked(fetchProducts).mockResolvedValue([makeProduct(1, "Flour"), makeProduct(2, "Cheese")]);
        jest.mocked(fetchVendors).mockResolvedValue([{ id: 1, vendorName: "Acme" }]);
        jest.mocked(getUser).mockResolvedValue({ id: 1, userName: "admin" });
        jest.mocked(getPurchaseReport).mockResolvedValue(report);
    });

    it("re-renders only the edited line when a value is committed", async () => {
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

        // Reports open collapsed, so the lines have to be revealed before they can be counted.
        fireEvent.click(await screen.findByTestId("toggle-invoice-inv-0"));

        await screen.findByTestId("commit-inv-0-line-0");
        expect(mockRowRenderCounts["inv-0-line-1"]).toBe(1);
        expect(mockRowRenderCounts["inv-0-line-2"]).toBe(1);

        fireEvent.click(screen.getByTestId("commit-inv-0-line-2"));

        // The edited line re-renders. The MIDDLE line is the real guarantee: it is untouched and
        // must be skipped — that is what keeps a 200-line report usable.
        await waitFor(() => expect(mockRowRenderCounts["inv-0-line-2"]).toBe(2));
        expect(mockRowRenderCounts["inv-0-line-1"]).toBe(1);

        // The invoice's identity cells (date, photo, vendor, paid) now live in the strip row, not
        // inside any product line's <tr> — so the FIRST line is no longer special-cased either and
        // must be skipped exactly like the middle line. This is the regression guard for the
        // structural win: editing a line can never re-render a sibling line, first or otherwise.
        expect(mockRowRenderCounts["inv-0-line-0"]).toBe(1);
    });

    it("does not re-render any line of a sibling invoice", async () => {
        jest.mocked(getPurchaseReport).mockResolvedValue({
            ...report,
            invoices: [
                report.invoices[0],
                { ...report.invoices[0], id: 2, products: [report.invoices[0].products[0]] },
            ],
        });

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

        fireEvent.click(await screen.findByTestId("toggle-invoice-inv-0"));
        fireEvent.click(screen.getByTestId("toggle-invoice-inv-1"));
        await screen.findByTestId("commit-inv-1-line-0");
        expect(mockRowRenderCounts["inv-1-line-0"]).toBe(1);

        fireEvent.click(screen.getByTestId("commit-inv-0-line-2"));

        await waitFor(() => expect(mockRowRenderCounts["inv-0-line-2"]).toBe(2));
        expect(mockRowRenderCounts["inv-1-line-0"]).toBe(1);
    });

    it("still re-renders only the edited line when the lines carry the create-product callback", async () => {
        mockUseAuth.mockReturnValue({ role: StaffRoles.MANAGER });

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

        fireEvent.click(await screen.findByTestId("toggle-invoice-inv-0"));
        await screen.findByTestId("commit-inv-0-line-0");
        expect(mockRowCanCreateProduct["inv-0-line-1"]).toBe(true);

        fireEvent.click(screen.getByTestId("commit-inv-0-line-2"));

        await waitFor(() => expect(mockRowRenderCounts["inv-0-line-2"]).toBe(2));
        expect(mockRowRenderCounts["inv-0-line-0"]).toBe(1);
        expect(mockRowRenderCounts["inv-0-line-1"]).toBe(1);
    });
});
