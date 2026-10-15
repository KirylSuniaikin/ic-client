import { jest, describe, it, expect, beforeEach, beforeAll } from "@jest/globals";
import React from "react";
import { act, render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { PurchaseTablePopup } from "./PurchaseTablePopup";
import {
    createPurchaseReport,
    createVendor,
    fetchProducts,
    fetchVendors,
    getUser,
} from "../../../../shared/api/management";
import { StaffRoles } from "../../../auth/types";
import { DuplicateVendorNameError } from "../types";
import type { IBranch, ProductTO } from "../../inventory/types";

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/management.ts
jest.mock("../../../../shared/api/management");

// The popup reads the caller's role from the token (getUser() carries none).
type AuthValue = { role: StaffRoles | null };
const mockUseAuth = jest.fn<AuthValue, []>();
jest.mock("../../../auth/context/AuthProvider", () => ({
    useAuth: () => mockUseAuth(),
}));

// jsdom's test environment lacks crypto.randomUUID (used by mkEmptyInvoice/mkEmptyLine).
let uuidCounter = 0;
function stubRandomUUID(): string { uuidCounter = uuidCounter + 1; return "test-uuid-" + uuidCounter; }
beforeAll(() => {
    if (typeof globalThis.crypto === "undefined" || typeof globalThis.crypto.randomUUID !== "function") {
        Object.defineProperty(globalThis, "crypto", { value: { randomUUID: stubRandomUUID }, configurable: true });
    }
});

const mockFetchProducts = jest.mocked(fetchProducts);
const mockFetchVendors = jest.mocked(fetchVendors);
const mockGetUser = jest.mocked(getUser);
const mockCreateVendor = jest.mocked(createVendor);
const mockCreatePurchaseReport = jest.mocked(createPurchaseReport);

const branch: IBranch = { id: "branch-uuid", externalId: "ext-1", branchNo: 1, branchName: "Main", locale: "en" };

const flour: ProductTO = {
    id: 1,
    name: "Flour",
    targetPrice: 7,
    price: 7,
    isInventory: true,
    isPurchasable: true,
    isBundle: false,
    topVendor: null,
    unit: "GRAMS",
};

function renderNewReport(): void {
    render(<PurchaseTablePopup open mode="new" userId={1} branch={branch} onClose={jest.fn()} />);
}

// Focus first, as a real tap does: an Autocomplete that is not focused resets its typed text back
// to the selected value on the next re-render, which would re-filter the list with "" and drop
// the "Add" entry before a test could see it.
function typeInto(input: HTMLInputElement, text: string): void {
    act(() => input.focus());
    fireEvent.change(input, { target: { value: text } });
}

function asInput(element: HTMLElement): HTMLInputElement {
    if (!(element instanceof HTMLInputElement)) throw new Error("not an input");
    return element;
}

// An invoice with no vendor yet shows "Select Vendor"; one with a vendor shows the vendor's name
// instead, so on a new report this finds the one invoice still waiting for its vendor.
async function typeIntoVendor(text: string): Promise<HTMLInputElement> {
    const input = asInput(await screen.findByPlaceholderText("Select Vendor"));
    typeInto(input, text);
    return input;
}

function optionNames(): string[] {
    return within(screen.getByRole("listbox")).queryAllByRole("option").map(o => o.textContent ?? "");
}

async function requestNewVendor(typed: string, option: string): Promise<HTMLInputElement> {
    const input = await typeIntoVendor(typed);
    fireEvent.click(await screen.findByRole("option", { name: option }));
    return input;
}

describe("PurchaseTablePopup — adding a vendor from the invoice's vendor dropdown", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUseAuth.mockReturnValue({ role: StaffRoles.MANAGER });
        mockFetchProducts.mockResolvedValue([flour]);
        mockFetchVendors.mockResolvedValue([{ id: 1, vendorName: "Acme" }]);
        mockGetUser.mockResolvedValue({ id: 1, userName: "admin" });
    });

    describe("the Add option", () => {
        it("is offered when the typed name matches no vendor", async () => {
            renderNewReport();

            await typeIntoVendor("Fresh Farms");

            expect(await screen.findByRole("option", { name: "Add “Fresh Farms”" })).toBeTruthy();
        });

        it("is not offered when the typed name is an existing vendor, whatever the case or spacing", async () => {
            renderNewReport();

            await typeIntoVendor("  aCME ");

            await screen.findByRole("listbox");
            expect(optionNames()).toEqual(["Acme"]);
        });

        it("lists the existing vendor when it is typed with doubled spaces, so there is something to pick", async () => {
            // MUI's filter only trims the ends: "fine  foods" matched nothing it would list, and the
            // Add entry was rightly withheld as a duplicate, so the list read "No options".
            mockFetchVendors.mockResolvedValue([{ id: 1, vendorName: "Acme" }, { id: 2, vendorName: "Fine Foods" }]);
            renderNewReport();

            await typeIntoVendor(" fine  FOODS ");

            await screen.findByRole("listbox");
            expect(optionNames()).toEqual(["Fine Foods"]);
        });

        it("is offered beside a partial match, since only an exact name counts as existing", async () => {
            renderNewReport();

            await typeIntoVendor("Ac");

            await screen.findByRole("listbox");
            expect(optionNames()).toEqual(["Acme", "Add “Ac”"]);
        });

        it("is not offered to a role that may not create vendors", async () => {
            mockUseAuth.mockReturnValue({ role: StaffRoles.COOK });
            renderNewReport();

            await typeIntoVendor("Fresh Farms");

            expect(await screen.findByText("No options")).toBeTruthy();
            expect(screen.queryByRole("option", { name: "Add “Fresh Farms”" })).toBeNull();
            expect(screen.queryByTestId("create-vendor-sheet")).toBeNull();
        });
    });

    describe("the create form it opens", () => {
        it("carries the typed name, cleaned, and leaves the invoice's vendor untouched", async () => {
            renderNewReport();

            const vendorInput = await requestNewVendor("  Fresh   Farms ", "Add “Fresh Farms”");

            const sheet = await screen.findByTestId("create-vendor-sheet");
            expect(within(sheet).getByText("New vendor")).toBeTruthy();
            expect(asInput(within(sheet).getByLabelText("Name")).value).toBe("Fresh Farms");
            // Choosing Add is a request, not a pick: nothing lands on the invoice until it exists.
            expect(vendorInput.value).toBe("");
            expect(vendorInput.placeholder).toBe("Select Vendor");
        });
    });

    describe("once the vendor is created", () => {
        it("puts it on the invoice and offers it in the other invoices' dropdowns", async () => {
            mockCreateVendor.mockResolvedValue({ id: 2, vendorName: "Fresh Farms" });
            renderNewReport();

            const vendorInput = await requestNewVendor("Fresh Farms", "Add “Fresh Farms”");
            fireEvent.click(await screen.findByTestId("create-vendor-submit"));

            await waitFor(() => expect(vendorInput.value).toBe("Fresh Farms"));
            await waitFor(() => expect(screen.queryByTestId("create-vendor-sheet")).toBeNull());
            expect(mockCreateVendor).toHaveBeenCalledWith("Fresh Farms");

            // The new invoice is the only one left reading "Select Vendor".
            fireEvent.click(screen.getByTestId("add-invoice"));
            await typeIntoVendor("fresh");

            await screen.findByRole("listbox");
            expect(optionNames()).toEqual(["Fresh Farms", "Add “fresh”"]);
        });

        // The backend resolves an invoice's vendor by its exact name, so the name saved must be the
        // one the server stored, not what was typed.
        it("saves the invoice under the created vendor's name", async () => {
            mockCreateVendor.mockResolvedValue({ id: 2, vendorName: "Fresh Farms" });
            mockCreatePurchaseReport.mockResolvedValue({
                report: { id: 9, title: "t", finalPrice: 5, createdAt: "", unpaidCount: 1, unpaidAmount: 5 },
                invoices: [],
            });
            renderNewReport();

            const vendorInput = await requestNewVendor("  fresh   Farms", "Add “fresh Farms”");
            fireEvent.click(await screen.findByTestId("create-vendor-submit"));
            await waitFor(() => expect(vendorInput.value).toBe("Fresh Farms"));

            typeInto(asInput(await screen.findByPlaceholderText("Select Product")), "Flour");
            fireEvent.click(await screen.findByRole("option", { name: "Flour" }));
            const [qty, total] = screen.getAllByPlaceholderText("0.000");
            fireEvent.change(qty, { target: { value: "1" } });
            fireEvent.blur(qty);
            fireEvent.change(total, { target: { value: "5" } });
            fireEvent.blur(total);
            fireEvent.click(screen.getByText("Save"));

            await waitFor(() => expect(mockCreatePurchaseReport).toHaveBeenCalledTimes(1));
            expect(mockCreateVendor).toHaveBeenCalledWith("fresh Farms");
            expect(mockCreatePurchaseReport.mock.calls[0][0].invoices[0].vendorName).toBe("Fresh Farms");
        });
    });

    // The sheet's focus trap hands focus back to whatever held it on open; an openOnFocus vendor
    // field taking it back would pop its dropdown open over the table as the sheet closes.
    describe("closing the create form", () => {
        it("does not re-open the vendor dropdown after a vendor is created", async () => {
            mockCreateVendor.mockResolvedValue({ id: 2, vendorName: "Fresh Farms" });
            renderNewReport();

            const vendorInput = await requestNewVendor("Fresh Farms", "Add “Fresh Farms”");
            fireEvent.click(await screen.findByTestId("create-vendor-submit"));
            await waitFor(() => expect(screen.queryByTestId("create-vendor-sheet")).toBeNull());

            expect(document.activeElement).not.toBe(vendorInput);
            expect(screen.queryByRole("listbox")).toBeNull();
        });

        it("does not re-open the vendor dropdown after the form is cancelled", async () => {
            renderNewReport();

            const vendorInput = await requestNewVendor("Fresh Farms", "Add “Fresh Farms”");
            const sheet = await screen.findByTestId("create-vendor-sheet");
            fireEvent.click(within(sheet).getByRole("button", { name: "Cancel" }));
            await waitFor(() => expect(screen.queryByTestId("create-vendor-sheet")).toBeNull());

            expect(document.activeElement).not.toBe(vendorInput);
            expect(screen.queryByRole("listbox")).toBeNull();
            expect(vendorInput.value).toBe("");
            expect(mockCreateVendor).not.toHaveBeenCalled();
        });
    });

    it("shows the server's duplicate refusal on the name field and leaves the invoice alone", async () => {
        mockCreateVendor.mockRejectedValue(new DuplicateVendorNameError());
        renderNewReport();

        const vendorInput = await requestNewVendor("Fresh Farms", "Add “Fresh Farms”");
        fireEvent.click(await screen.findByTestId("create-vendor-submit"));

        const sheet = await screen.findByTestId("create-vendor-sheet");
        expect(await within(sheet).findByText("A vendor with this name already exists")).toBeTruthy();
        expect(within(sheet).getByLabelText("Name").getAttribute("aria-invalid")).toBe("true");
        expect(vendorInput.value).toBe("");
    });
});
