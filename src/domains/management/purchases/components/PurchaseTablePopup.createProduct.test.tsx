import { jest, describe, it, expect, beforeEach, beforeAll } from "@jest/globals";
import React from "react";
import { act, render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { PurchaseTablePopup } from "./PurchaseTablePopup";
import {
    createProduct,
    fetchProducts,
    fetchVendors,
    getUser,
} from "../../../../shared/api/management";
import { StaffRoles } from "../../../auth/types";
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
const mockCreateProduct = jest.mocked(createProduct);

const branch: IBranch = { id: "branch-uuid", externalId: "ext-1", branchNo: 1, branchName: "Main", locale: "en" };

function product(overrides: Partial<ProductTO> = {}): ProductTO {
    return {
        id: 1,
        name: "Flour",
        targetPrice: 7,
        price: 7,
        isInventory: true,
        isPurchasable: true,
        isBundle: false,
        topVendor: null,
        unit: "GRAMS",
        ...overrides,
    };
}

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

async function typeIntoProduct(text: string): Promise<HTMLInputElement> {
    const input = await screen.findByPlaceholderText("Select Product");
    if (!(input instanceof HTMLInputElement)) throw new Error("product field is not an input");
    typeInto(input, text);
    return input;
}

function optionNames(): string[] {
    return within(screen.getByRole("listbox")).queryAllByRole("option").map(o => o.textContent ?? "");
}

async function fillAndSubmitCreateForm(): Promise<void> {
    fireEvent.change(await screen.findByLabelText("Target price"), { target: { value: "1.5" } });
    fireEvent.mouseDown(within(screen.getByTestId("create-product-unit")).getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: "g" }));
    fireEvent.click(screen.getByTestId("create-product-submit"));
}

describe("PurchaseTablePopup — adding a product from the line dropdown", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUseAuth.mockReturnValue({ role: StaffRoles.MANAGER });
        mockFetchProducts.mockResolvedValue([product()]);
        mockFetchVendors.mockResolvedValue([{ id: 1, vendorName: "Acme" }]);
        mockGetUser.mockResolvedValue({ id: 1, userName: "admin" });
    });

    describe("the Add option", () => {
        it("is offered when the typed name matches no product", async () => {
            renderNewReport();

            await typeIntoProduct("Basil");

            expect(await screen.findByRole("option", { name: "Add “Basil”" })).toBeTruthy();
        });

        it("is not offered when the typed name is an existing product, whatever the case or spacing", async () => {
            renderNewReport();

            await typeIntoProduct("  fLOUR ");

            await screen.findByRole("listbox");
            expect(optionNames()).toEqual(["Flour"]);
        });

        it("is offered beside a partial match, since only an exact name counts as existing", async () => {
            renderNewReport();

            await typeIntoProduct("Flo");

            await screen.findByRole("listbox");
            expect(optionNames()).toEqual(["Flour", "Add “Flo”"]);
        });

        it("is not offered to a role that may not create products", async () => {
            mockUseAuth.mockReturnValue({ role: StaffRoles.COOK });
            renderNewReport();

            await typeIntoProduct("Basil");

            expect(await screen.findByText("No options")).toBeTruthy();
            expect(screen.queryByRole("option", { name: "Add “Basil”" })).toBeNull();
        });
    });

    describe("the create form it opens", () => {
        it("carries the typed name, Purchasable locked on, and the invoice's vendor", async () => {
            renderNewReport();
            const vendorInput = await screen.findByPlaceholderText("Select Vendor");
            fireEvent.change(vendorInput, { target: { value: "Acme" } });
            fireEvent.click(await screen.findByRole("option", { name: "Acme" }));

            await typeIntoProduct("Basil");
            fireEvent.click(await screen.findByRole("option", { name: "Add “Basil”" }));

            const nameInput = await screen.findByLabelText("Name");
            expect((nameInput as HTMLInputElement).value).toBe("Basil");
            const purchasable = screen.getByLabelText("Purchasable") as HTMLInputElement;
            expect(purchasable.checked).toBe(true);
            expect(purchasable.disabled).toBe(true);
            expect(within(screen.getByTestId("create-product-vendor")).getByRole("combobox").textContent).toBe("Acme");
        });

        it("explains a name that exists but is left out of the dropdown for not being purchasable", async () => {
            mockFetchProducts.mockResolvedValue([product(), product({ id: 2, name: "Basil", isPurchasable: false })]);
            renderNewReport();

            await typeIntoProduct("Basil");
            fireEvent.click(await screen.findByRole("option", { name: "Add “Basil”" }));

            expect(await screen.findByText(/already exists, but it is not purchasable/)).toBeTruthy();
        });
    });

    describe("once the product is created", () => {
        it("selects it on the line and fills the empty invoice vendor from its top vendor", async () => {
            const basil = product({ id: 2, name: "Basil", targetPrice: 1.5, price: null, topVendor: "Acme" });
            mockCreateProduct.mockResolvedValue(basil);
            renderNewReport();
            const vendorInput = await screen.findByPlaceholderText("Select Vendor") as HTMLInputElement;

            const productInput = await typeIntoProduct("Basil");
            fireEvent.click(await screen.findByRole("option", { name: "Add “Basil”" }));
            await fillAndSubmitCreateForm();

            await waitFor(() => expect(productInput.value).toBe("Basil"));
            expect(vendorInput.value).toBe("Acme");
            expect(screen.getByTestId("target-price-cell").textContent).toBe("1.500");
            await waitFor(() => expect(screen.queryByTestId("create-product-sheet")).toBeNull());
            expect(mockCreateProduct.mock.calls[0][0]).toMatchObject({ name: "Basil", isPurchasable: true });
        });

        it("offers it in the dropdown from then on", async () => {
            mockCreateProduct.mockResolvedValue(product({ id: 2, name: "Basil" }));
            renderNewReport();

            const firstLine = await typeIntoProduct("Basil");
            fireEvent.click(await screen.findByRole("option", { name: "Add “Basil”" }));
            await fillAndSubmitCreateForm();
            await waitFor(() => expect(firstLine.value).toBe("Basil"));

            // The strip and the last line both carry the invoice's add-line button. A line with a
            // product shows that product as its placeholder, so the new line is the only one left
            // reading "Select Product".
            fireEvent.click(screen.getAllByTestId(/^add-line-/)[0]);
            await typeIntoProduct("bas");

            await screen.findByRole("listbox");
            expect(optionNames()).toEqual(["Basil", "Add “bas”"]);
        });
    });

    // The sheet's focus trap hands focus back to whatever held it on open; an openOnFocus product
    // field taking it back would pop its dropdown open over the table as the sheet closes.
    describe("closing the create form", () => {
        it("does not re-open the line's dropdown after a product is created", async () => {
            mockCreateProduct.mockResolvedValue(product({ id: 2, name: "Basil" }));
            renderNewReport();

            const productInput = await typeIntoProduct("Basil");
            fireEvent.click(await screen.findByRole("option", { name: "Add “Basil”" }));
            await fillAndSubmitCreateForm();
            await waitFor(() => expect(screen.queryByTestId("create-product-sheet")).toBeNull());

            expect(document.activeElement).not.toBe(productInput);
            expect(screen.queryByRole("listbox")).toBeNull();
        });

        it("does not re-open the line's dropdown after the form is cancelled", async () => {
            renderNewReport();

            const productInput = await typeIntoProduct("Basil");
            fireEvent.click(await screen.findByRole("option", { name: "Add “Basil”" }));
            const sheet = await screen.findByTestId("create-product-sheet");
            fireEvent.click(within(sheet).getByRole("button", { name: "Close" }));
            await waitFor(() => expect(screen.queryByTestId("create-product-sheet")).toBeNull());

            expect(document.activeElement).not.toBe(productInput);
            expect(screen.queryByRole("listbox")).toBeNull();
        });
    });
});
