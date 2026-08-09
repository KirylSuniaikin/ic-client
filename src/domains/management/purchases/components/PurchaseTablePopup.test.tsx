import { jest, describe, it, expect, beforeEach, beforeAll } from "@jest/globals";
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

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/management.ts
jest.mock("../../../../shared/api/management");

// jsdom's test environment lacks crypto.randomUUID (used by mkEmptyInvoice/mkEmptyLine).
let uuidCounter = 0;
function stubRandomUUID() { uuidCounter = uuidCounter + 1; return "test-uuid-" + uuidCounter; }
beforeAll(function () {
    if (typeof globalThis.crypto === "undefined" || typeof globalThis.crypto.randomUUID !== "function") {
        var cryptoStub = { randomUUID: stubRandomUUID };
        Object.defineProperty(globalThis, "crypto", { value: cryptoStub, configurable: true });
    }
});

const mockFetchProducts = jest.mocked(fetchProducts);
const mockFetchVendors = jest.mocked(fetchVendors);
const mockGetUser = jest.mocked(getUser);

const branch: IBranch = {
    id: "branch-uuid",
    externalId: "ext-1",
    branchNo: 1,
    branchName: "Main",
    locale: "en",
};

// One DatePicker per INVOICE header now, so DD.MM.YYYY inputs in DOM order are the invoice order.
function allDateInputs(): HTMLInputElement[] {
    return Array.from(document.querySelectorAll("input")).filter((i) =>
        /^\d{2}\.\d{2}\.\d{4}$/.test((i as HTMLInputElement).value)
    ) as HTMLInputElement[];
}

function dateCellValues(): string[] {
    return allDateInputs().map((i) => i.value);
}

const flour: ProductTO = {
    id: 1,
    name: "Flour",
    targetPrice: 7,
    price: 7,
    isInventory: true,
    isPurchasable: true,
    isBundle: false,
    topVendor: "Acme",
};

/** Opens an existing report with one invoice per given date, each holding a single line. */
function renderReportWithDates(invoiceDates: string[]) {
    jest.mocked(fetchProducts).mockResolvedValue([flour]);
    jest.mocked(getPurchaseReport).mockResolvedValue({
        id: 7,
        title: "jul-25-bh-admin",
        finalPrice: 0,
        userId: 1,
        purchaseDate: "2026-07-14",
        invoices: invoiceDates.map((invoiceDate) => ({
            id: 1,
            invoiceDate,
            vendorName: "Acme",
            paid: false,
            finalPrice: 10,
            hasImage: false,
            products: [{ product: flour, quantity: 1, finalPrice: 10, price: 10 }],
        })),
    });

    return render(
        <PurchaseTablePopup
            open={true}
            mode="edit"
            purchaseId={7}
            userId={1}
            branch={branch}
            onClose={jest.fn()}
        />
    );
}

describe("PurchaseTablePopup", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFetchProducts.mockResolvedValue([]);
        mockFetchVendors.mockResolvedValue([]);
        mockGetUser.mockResolvedValue({ id: 1, userName: "admin" });
    });

    it("renders a brand-new line's quantity and finalPrice cells as empty placeholders, not literal 0.000", async () => {
        render(
            <PurchaseTablePopup
                open={true}
                mode="new"
                userId={1}
                branch={branch}
                onClose={jest.fn()}
            />
        );

        const placeholders = await screen.findAllByPlaceholderText("0.000");

        // quantity + finalPrice cells for the single line of the single mkEmptyInvoice()
        expect(placeholders).toHaveLength(2);
        placeholders.forEach((el) => {
            expect((el as HTMLInputElement).value).toBe("");
        });
    });

    it("allows typing into a never-touched quantity cell without deleting anything first", async () => {
        render(
            <PurchaseTablePopup
                open={true}
                mode="new"
                userId={1}
                branch={branch}
                onClose={jest.fn()}
            />
        );

        const [quantityInput] = await screen.findAllByPlaceholderText("0.000");

        fireEvent.change(quantityInput, { target: { value: "2" } });

        expect((quantityInput as HTMLInputElement).value).toBe("2");
    });

    it("leaves the cell empty (not reverting to 0.000 literal text) after blurring an untouched cell", async () => {
        render(
            <PurchaseTablePopup
                open={true}
                mode="new"
                userId={1}
                branch={branch}
                onClose={jest.fn()}
            />
        );

        const [quantityInput] = await screen.findAllByPlaceholderText("0.000");

        fireEvent.blur(quantityInput);

        await waitFor(() => {
            expect((quantityInput as HTMLInputElement).value).toBe("");
        });
    });

    it("reorders invoices by date on sort tap, newest first then oldest first", async () => {
        renderReportWithDates(["2026-07-10", "2026-07-20"]);
        await waitFor(() => expect(dateCellValues()).toEqual(["10.07.2026", "20.07.2026"]));

        fireEvent.click(screen.getByTestId("sort-invoiceDate"));
        await waitFor(() => expect(dateCellValues()).toEqual(["20.07.2026", "10.07.2026"]));

        fireEvent.click(screen.getByTestId("sort-invoiceDate"));
        await waitFor(() => expect(dateCellValues()).toEqual(["10.07.2026", "20.07.2026"]));
    });

    it("sorts from the toolbar control, with no separate sort block above the table", async () => {
        renderReportWithDates(["2026-07-10", "2026-07-20"]);
        await waitFor(() => expect(dateCellValues()).toEqual(["10.07.2026", "20.07.2026"]));

        expect(screen.queryByText("Sort by:")).toBeNull();

        // There is no <TableHead> any more — each invoice group carries its own inline header
        // instead — and these two invoices load collapsed, so no inline header renders either:
        // there is no columnheader anywhere for a sort control to attach to. sort-invoiceDate
        // instead resolves to a plain toolbar Button.
        expect(screen.queryAllByRole("columnheader")).toHaveLength(0);
        const sortButton = screen.getByTestId("sort-invoiceDate");
        expect(sortButton.tagName).toBe("BUTTON");

        // Positively place the sort control inside the toolbar, alongside collapse-all/expand-all
        // — not just "not a columnheader". Both live in the same toolbar row (purchase-toolbar);
        // .contains() is the allowed containment check here (unlike .closest()/querySelectorAll).
        const toolbar = screen.getByTestId("purchase-toolbar");
        expect(toolbar.contains(sortButton)).toBe(true);
        expect(toolbar.contains(screen.getByTestId("collapse-all"))).toBe(true);

        fireEvent.click(sortButton);

        await waitFor(() => expect(dateCellValues()).toEqual(["20.07.2026", "10.07.2026"]));
    });

    it("leaves an edited invoice in place, re-ordering only on the next sort tap", async () => {
        renderReportWithDates(["2026-07-10", "2026-07-20"]);
        await waitFor(() => expect(dateCellValues()).toEqual(["10.07.2026", "20.07.2026"]));

        fireEvent.click(screen.getByTestId("sort-invoiceDate"));
        await waitFor(() => expect(dateCellValues()).toEqual(["20.07.2026", "10.07.2026"]));

        // Give the bottom invoice the newest date of all. Under a live re-sort it would jump to
        // the top mid-edit; with a snapshot it must stay exactly where it is.
        fireEvent.change(allDateInputs()[1], { target: { value: "31.07.2026" } });
        await waitFor(() => expect(dateCellValues()).toEqual(["20.07.2026", "31.07.2026"]));

        // Tapping again resumes ordering: asc first (the toggle), then desc.
        fireEvent.click(screen.getByTestId("sort-invoiceDate"));
        await waitFor(() => expect(dateCellValues()).toEqual(["20.07.2026", "31.07.2026"]));

        fireEvent.click(screen.getByTestId("sort-invoiceDate"));
        await waitFor(() => expect(dateCellValues()).toEqual(["31.07.2026", "20.07.2026"]));
    });

    it("opens the unit-price header hint on tap, not just on hover (tablet entry)", async () => {
        render(
            <PurchaseTablePopup
                open={true}
                mode="new"
                userId={1}
                branch={branch}
                onClose={jest.fn()}
            />
        );

        // Header order is Amount, Unit, Target — three info icons now that Amount carries one too,
        // so the unit-price hint is the second, not the first.
        const infoIcons = await screen.findAllByTestId("InfoOutlinedIcon");
        const unitPriceInfo = infoIcons[1];

        fireEvent.touchStart(unitPriceInfo);

        expect(await screen.findByText("Actual price paid per kg/unit — total price ÷ amount.")).toBeTruthy();
    });

    it("does not prefill the unit price with the product's target price on selection", async () => {
        mockFetchProducts.mockResolvedValue([flour]);
        mockFetchVendors.mockResolvedValue([{ id: 1, vendorName: "Acme" }]);

        render(
            <PurchaseTablePopup
                open={true}
                mode="new"
                userId={1}
                branch={branch}
                onClose={jest.fn()}
            />
        );

        const productInput = await screen.findByPlaceholderText("Select Product");
        fireEvent.change(productInput, { target: { value: "Flour" } });
        fireEvent.click(await screen.findByRole("option", { name: "Flour" }));

        // The target lands in its own column, but the unit price stays empty until
        // amount and total derive it.
        await waitFor(() => {
            expect(screen.getByTestId("target-price-cell").textContent).toBe("7.000");
        });
        expect((productInput as HTMLInputElement).value).toBe("Flour");
        expect(screen.getByTestId("unit-price-cell").textContent).toBe("—");
    });

    it("fills the invoice vendor from the product's top vendor when the vendor is still empty", async () => {
        mockFetchProducts.mockResolvedValue([flour]);
        mockFetchVendors.mockResolvedValue([{ id: 1, vendorName: "Acme" }]);

        render(
            <PurchaseTablePopup
                open={true}
                mode="new"
                userId={1}
                branch={branch}
                onClose={jest.fn()}
            />
        );

        const productInput = await screen.findByPlaceholderText("Select Product");
        // Grab the vendor input BEFORE selecting: once auto-fill lands, its placeholder becomes
        // the vendor name, so "Select Vendor" no longer matches.
        const vendorInput = screen.getByPlaceholderText("Select Vendor") as HTMLInputElement;

        fireEvent.change(productInput, { target: { value: "Flour" } });
        fireEvent.click(await screen.findByRole("option", { name: "Flour" }));

        // Vendor auto-fill now lands on the invoice's strip, not on the line.
        await waitFor(() => expect(vendorInput.value).toBe("Acme"));
    });

    it("commits a typed value on blur and displays it as a real (non-placeholder) value", async () => {
        render(
            <PurchaseTablePopup
                open={true}
                mode="new"
                userId={1}
                branch={branch}
                onClose={jest.fn()}
            />
        );

        const [quantityInput] = await screen.findAllByPlaceholderText("0.000");

        fireEvent.change(quantityInput, { target: { value: "2.5" } });
        fireEvent.blur(quantityInput);

        await waitFor(() => {
            expect((quantityInput as HTMLInputElement).value).toBe("2.500");
        });
    });

    // colSpan guard — mirrors inventory/components/InventoryPopup.test.tsx:172-192. Nothing else
    // keeps the strip cell's colSpan and the inline header row's cell count in sync besides both
    // deriving from PRODUCT_COLUMN_COUNT; this catches the two literals drifting apart.
    // Integration-level guard: exercises the invariant through the full popup (real save/collapse
    // wiring, not an isolated group). The unit-level twin in PurchaseInvoiceGroup.test.tsx covers
    // the same invariant on the isolated component — the two are deliberately not redundant (see
    // phases-status.md Phase 2/4 notes).
    it("keeps the strip cell's colSpan equal to the inline header row's cell count", async () => {
        render(
            <PurchaseTablePopup
                open={true}
                mode="new"
                userId={1}
                branch={branch}
                onClose={jest.fn()}
            />
        );

        // A brand-new invoice opens expanded with one empty line, so both the strip and the
        // inline header are present as soon as the line's placeholders render.
        await screen.findAllByPlaceholderText("0.000");

        // Sanity-check the strip itself rendered before reading its cell.
        expect(screen.getByText("1 product")).toBeTruthy();

        const headerCellCount = screen.getAllByRole("columnheader").length;
        // With one invoice and one line, getAllByRole("cell") is [strip cell, ...6 line cells] —
        // the strip is always first. Reading the colspan attribute (rather than the `.colSpan`
        // DOM property) mirrors the getAttribute("colspan") form PurchaseInvoiceGroup.test.tsx:192
        // already uses, so no `as HTMLTableCellElement` cast is needed here either.
        const stripCell = screen.getAllByRole("cell")[0];

        expect(Number(stripCell.getAttribute("colspan"))).toBe(headerCellCount);
    });
});
