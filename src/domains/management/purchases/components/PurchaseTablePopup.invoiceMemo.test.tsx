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

// The role decides whether groups get the create-vendor callback at all; a manager's do, and that
// callback must be as stable as the others or editing one invoice re-renders all of them.
type AuthValue = { role: StaffRoles | null };
const mockUseAuth = jest.fn<AuthValue, []>();
jest.mock("../../../auth/context/AuthProvider", () => ({
    useAuth: () => mockUseAuth(),
}));

/**
 * The invoice-level half of the memo guarantee (the line-level half lives in
 * PurchaseTablePopup.rowMemo.test.tsx).
 *
 * Each invoice card holds a DatePicker, an Autocomplete and a whole product table, so an invoice
 * that re-renders because a SIBLING invoice was edited is far more expensive than a stray row.
 * This is the exact regression a table-level callback would cause by closing over `invoices`
 * instead of using the functional setState form.
 */
const mockBlockRenderCounts: Record<string, number> = {};
const mockBlockCanCreateVendor: Record<string, boolean> = {};

jest.mock("./PurchaseInvoiceGroup", () => {
    const react: typeof React = require("react");
    type MockGroupProps = {
        invoice: { id: string; paid: boolean };
        onUpdateInvoice: (invoiceId: string, patch: { paid: boolean }) => void;
        onRequestCreateVendor?: (invoiceId: string, name: string) => void;
    };
    return {
        // Renders a <tr>, since the real group is mounted directly inside <TableBody>.
        PurchaseInvoiceGroup: react.memo(function MockPurchaseInvoiceGroup({ invoice, onUpdateInvoice, onRequestCreateVendor }: MockGroupProps) {
            mockBlockRenderCounts[invoice.id] = (mockBlockRenderCounts[invoice.id] ?? 0) + 1;
            mockBlockCanCreateVendor[invoice.id] = typeof onRequestCreateVendor === "function";
            return react.createElement(
                "tr",
                null,
                react.createElement(
                    "td",
                    null,
                    react.createElement(
                        "button",
                        {
                            "data-testid": `toggle-paid-${invoice.id}`,
                            onClick: () => onUpdateInvoice(invoice.id, { paid: !invoice.paid }),
                        },
                        invoice.id,
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

// Two separate invoices, one line each.
const report: PurchaseTO = {
    id: 7,
    title: "jul-25-bh-admin",
    finalPrice: 0,
    userId: 1,
    purchaseDate: "2026-07-14",
    invoices: [
        {
            id: 1,
            invoiceDate: "2026-07-10",
            vendorName: "Acme",
            paid: false,
            finalPrice: 10,
            hasImage: false,
            products: [{ product: makeProduct(1, "Flour"), quantity: 1, finalPrice: 10, price: 10 }],
        },
        {
            id: 2,
            invoiceDate: "2026-07-20",
            vendorName: "Beta",
            paid: false,
            finalPrice: 20,
            hasImage: false,
            products: [{ product: makeProduct(2, "Cheese"), quantity: 2, finalPrice: 20, price: 10 }],
        },
    ],
};

describe("PurchaseTablePopup invoice memoization", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        for (const key of Object.keys(mockBlockRenderCounts)) {
            delete mockBlockRenderCounts[key];
        }
        mockUseAuth.mockReturnValue({ role: null });
        jest.mocked(fetchProducts).mockResolvedValue([makeProduct(1, "Flour"), makeProduct(2, "Cheese")]);
        jest.mocked(fetchVendors).mockResolvedValue([
            { id: 1, vendorName: "Acme" },
            { id: 2, vendorName: "Beta" },
        ]);
        jest.mocked(getUser).mockResolvedValue({ id: 1, userName: "admin" });
        jest.mocked(getPurchaseReport).mockResolvedValue(report);
    });

    it("re-renders only the edited invoice when one invoice is changed", async () => {
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

        await screen.findByTestId("toggle-paid-inv-0");
        expect(mockBlockRenderCounts["inv-0"]).toBe(1);
        expect(mockBlockRenderCounts["inv-1"]).toBe(1);

        fireEvent.click(screen.getByTestId("toggle-paid-inv-0"));

        await waitFor(() => expect(mockBlockRenderCounts["inv-0"]).toBe(2));
        expect(mockBlockRenderCounts["inv-1"]).toBe(1);
    });

    it("still re-renders only the edited invoice when the groups carry the create-vendor callback", async () => {
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

        await screen.findByTestId("toggle-paid-inv-0");
        expect(mockBlockCanCreateVendor["inv-1"]).toBe(true);
        expect(mockBlockRenderCounts["inv-1"]).toBe(1);

        fireEvent.click(screen.getByTestId("toggle-paid-inv-0"));

        await waitFor(() => expect(mockBlockRenderCounts["inv-0"]).toBe(2));
        expect(mockBlockRenderCounts["inv-1"]).toBe(1);
    });
});
