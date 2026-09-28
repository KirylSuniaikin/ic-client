import {jest, describe, it, expect, beforeEach} from "@jest/globals";
import React from "react";
import {render, screen, fireEvent, waitFor, within} from "@testing-library/react";
import {StaffRoles} from "../../../auth/types";
import type {ProductTO} from "../../inventory/types";
import type {VendorTO} from "../../purchases/types";
import type {ProductSettingsPatch} from "../hooks/useProductCatalog";

// jsdom's test environment lacks TextEncoder/TextDecoder, which @mui/x-data-grid needs at import
// time. A plain `import` of ProductsTable would be hoisted by Babel's commonjs transform ABOVE this
// polyfill, so the component is loaded via require() below -- same as RevenueByHourTable.test.tsx.
type ProductsTableModule = typeof import("./ProductsTable");
const nodeUtil: typeof import("util") = require("util");
if (typeof (global as {TextEncoder?: unknown}).TextEncoder === "undefined") {
    // Node's util.TextEncoder/TextDecoder are structurally compatible with the DOM lib globals
    // jsdom expects here, just not nominally typed as the same interfaces.
    global.TextEncoder = nodeUtil.TextEncoder as unknown as typeof TextEncoder;
    global.TextDecoder = nodeUtil.TextDecoder as unknown as typeof TextDecoder;
}
const {ProductsTable}: ProductsTableModule = require("./ProductsTable");

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/management.ts
jest.mock("../../../../shared/api/management");

import {createProduct, fetchProducts, fetchVendors, updateProductSettings} from "../../../../shared/api/management";

const mockFetchProducts = jest.mocked(fetchProducts);
const mockFetchVendors = jest.mocked(fetchVendors);
const mockUpdateProductSettings = jest.mocked(updateProductSettings);
const mockCreateProduct = jest.mocked(createProduct);

const VENDORS: VendorTO[] = [
    {id: 1, vendorName: "Acme"},
    {id: 2, vendorName: "Bahrain Foods"},
];

function product(overrides: Partial<ProductTO> = {}): ProductTO {
    return {
        id: 1,
        name: "Flour",
        targetPrice: 7,
        price: 6.5,
        isInventory: true,
        isPurchasable: false,
        isBundle: false,
        // Hand-backfilled spelling: the server's vendor is "Acme".
        topVendor: "acme",
        unit: "GRAMS",
        ...overrides,
    };
}

function switchFor(label: string): HTMLInputElement {
    const input = screen.getByLabelText(label);
    if (!(input instanceof HTMLInputElement)) throw new Error(`${label} is not an input`);
    return input;
}

function pickInCell(comboboxName: string, optionName: string): void {
    fireEvent.mouseDown(screen.getByRole("combobox", {name: comboboxName}));
    fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", {name: optionName}));
}

describe("ProductsTable", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFetchProducts.mockResolvedValue([product()]);
        mockFetchVendors.mockResolvedValue(VENDORS);
    });

    describe("permissions", () => {
        it.each([StaffRoles.MANAGER, StaffRoles.SUPER_MANAGER, StaffRoles.OWNER])(
            "offers Add product and editable settings to %s",
            async (role) => {
                render(<ProductsTable role={role}/>);

                await screen.findByText("Flour");

                expect(screen.getByTestId("add-product")).toBeTruthy();
                expect(switchFor("Purchasable: Flour").disabled).toBe(false);
            },
        );

        it.each([StaffRoles.COOK, StaffRoles.SUPERVISOR, StaffRoles.REVIEWER])(
            "shows %s the settings read-only, with no Add product",
            async (role) => {
                render(<ProductsTable role={role}/>);

                await screen.findByText("Flour");

                expect(screen.queryByTestId("add-product")).toBeNull();
                expect(switchFor("Purchasable: Flour").disabled).toBe(true);
                expect(switchFor("Inventory: Flour").disabled).toBe(true);
                expect(screen.getByRole("combobox", {name: "Unit: Flour"}).getAttribute("aria-disabled")).toBe("true");
                expect(screen.getByRole("combobox", {name: "Top vendor: Flour"}).getAttribute("aria-disabled")).toBe("true");
            },
        );
    });

    describe("inline settings", () => {
        it("shows each row's current settings", async () => {
            render(<ProductsTable role={StaffRoles.MANAGER}/>);

            await screen.findByText("Flour");

            expect(switchFor("Purchasable: Flour").checked).toBe(false);
            expect(switchFor("Inventory: Flour").checked).toBe(true);
            expect(screen.getByRole("combobox", {name: "Unit: Flour"}).textContent).toBe("g");
            expect(screen.getByRole("combobox", {name: "Top vendor: Flour"}).textContent).toBe("Acme");
        });

        it("sends the row's full four-field state when one switch is flipped, with the vendor's own spelling", async () => {
            mockUpdateProductSettings.mockResolvedValue(product({isPurchasable: true, topVendor: "Acme"}));
            render(<ProductsTable role={StaffRoles.MANAGER}/>);
            await screen.findByText("Flour");

            fireEvent.click(switchFor("Purchasable: Flour"));

            await waitFor(() => expect(mockUpdateProductSettings).toHaveBeenCalledTimes(1));
            expect(mockUpdateProductSettings).toHaveBeenCalledWith(1, {
                isInventory: true,
                isPurchasable: true,
                unit: "GRAMS",
                topVendor: "Acme",
            });
        });

        it("shows the change at once, before the server answers", async () => {
            mockUpdateProductSettings.mockReturnValue(new Promise<ProductTO>(() => undefined));
            render(<ProductsTable role={StaffRoles.MANAGER}/>);
            await screen.findByText("Flour");

            fireEvent.click(switchFor("Purchasable: Flour"));

            await waitFor(() => expect(switchFor("Purchasable: Flour").checked).toBe(true));
            // The row stays locked until that save answers, so a second change cannot race it.
            expect(switchFor("Inventory: Flour").disabled).toBe(true);
        });

        it("sends a new unit with the other three settings unchanged", async () => {
            mockUpdateProductSettings.mockResolvedValue(product({unit: "PIECES"}));
            render(<ProductsTable role={StaffRoles.OWNER}/>);
            await screen.findByText("Flour");

            pickInCell("Unit: Flour", "pcs");

            await waitFor(() => expect(mockUpdateProductSettings).toHaveBeenCalledTimes(1));
            expect(mockUpdateProductSettings).toHaveBeenCalledWith(1, {
                isInventory: true,
                isPurchasable: false,
                unit: "PIECES",
                topVendor: "Acme",
            });
        });

        it("clears the top vendor with None", async () => {
            mockUpdateProductSettings.mockResolvedValue(product({topVendor: null}));
            render(<ProductsTable role={StaffRoles.SUPER_MANAGER}/>);
            await screen.findByText("Flour");

            pickInCell("Top vendor: Flour", "None");

            await waitFor(() => expect(mockUpdateProductSettings).toHaveBeenCalledTimes(1));
            expect(mockUpdateProductSettings.mock.calls[0][1].topVendor).toBeNull();
        });

        it("sets a real vendor as the top vendor, with the other three settings unchanged", async () => {
            mockUpdateProductSettings.mockResolvedValue(product({topVendor: "Bahrain Foods"}));
            render(<ProductsTable role={StaffRoles.MANAGER}/>);
            await screen.findByText("Flour");

            pickInCell("Top vendor: Flour", "Bahrain Foods");

            await waitFor(() => expect(mockUpdateProductSettings).toHaveBeenCalledTimes(1));
            expect(mockUpdateProductSettings).toHaveBeenCalledWith(1, {
                isInventory: true,
                isPurchasable: false,
                unit: "GRAMS",
                topVendor: "Bahrain Foods",
            });
        });

        it("lets a legacy row with no unit toggle a switch, sending unit null", async () => {
            mockFetchProducts.mockResolvedValue([product({unit: null})]);
            mockUpdateProductSettings.mockResolvedValue(product({unit: null, isInventory: false}));
            render(<ProductsTable role={StaffRoles.MANAGER}/>);
            await screen.findByText("Flour");

            expect(screen.getByRole("combobox", {name: "Unit: Flour"}).textContent).toBe("—");
            fireEvent.click(switchFor("Inventory: Flour"));

            await waitFor(() => expect(mockUpdateProductSettings).toHaveBeenCalledTimes(1));
            expect(mockUpdateProductSettings.mock.calls[0][1].unit).toBeNull();
        });

        it("puts the row back and says why when the save fails", async () => {
            mockUpdateProductSettings.mockRejectedValue(new Error("HTTP 400"));
            render(<ProductsTable role={StaffRoles.MANAGER}/>);
            await screen.findByText("Flour");

            fireEvent.click(switchFor("Purchasable: Flour"));

            expect(await screen.findByText("Couldn't save “Flour”: HTTP 400")).toBeTruthy();
            expect(switchFor("Purchasable: Flour").checked).toBe(false);
            expect(switchFor("Purchasable: Flour").disabled).toBe(false);
        });

        it("reports exactly the changed fields to onSettingsSaved once the server accepts them", async () => {
            const onSettingsSaved = jest.fn<void, [ProductSettingsPatch]>();
            mockUpdateProductSettings.mockResolvedValue(product({unit: "PIECES"}));
            render(<ProductsTable role={StaffRoles.OWNER} onSettingsSaved={onSettingsSaved}/>);
            await screen.findByText("Flour");

            pickInCell("Unit: Flour", "pcs");

            await waitFor(() => expect(onSettingsSaved).toHaveBeenCalledTimes(1));
            expect(onSettingsSaved).toHaveBeenCalledWith({unit: "PIECES"});
        });

        it("does not report a save the server refused to onSettingsSaved", async () => {
            const onSettingsSaved = jest.fn<void, [ProductSettingsPatch]>();
            mockUpdateProductSettings.mockRejectedValue(new Error("HTTP 400"));
            render(<ProductsTable role={StaffRoles.OWNER} onSettingsSaved={onSettingsSaved}/>);
            await screen.findByText("Flour");

            pickInCell("Unit: Flour", "pcs");

            expect(await screen.findByText("Couldn't save “Flour”: HTTP 400")).toBeTruthy();
            expect(onSettingsSaved).not.toHaveBeenCalled();
        });
    });

    describe("a legacy top vendor that matches no vendor", () => {
        beforeEach(() => {
            mockFetchProducts.mockResolvedValue([product({topVendor: "Old Supplier Co"})]);
        });

        it("is shown marked as unknown, and not offered as a choice", async () => {
            render(<ProductsTable role={StaffRoles.MANAGER}/>);
            await screen.findByText("Flour");

            const vendorSelect = screen.getByRole("combobox", {name: "Top vendor: Flour"});
            await waitFor(() => expect(vendorSelect.textContent).toBe("Old Supplier Co (unknown vendor)"));
            fireEvent.mouseDown(vendorSelect);
            const option = within(screen.getByRole("listbox")).getByRole("option", {name: "Old Supplier Co (unknown vendor)"});
            expect(option.getAttribute("aria-disabled")).toBe("true");
        });

        it("is sent back unchanged when a switch is flipped, never silently cleared", async () => {
            mockUpdateProductSettings.mockResolvedValue(product({topVendor: "Old Supplier Co", isPurchasable: true}));
            render(<ProductsTable role={StaffRoles.MANAGER}/>);
            await screen.findByText("Flour");

            fireEvent.click(switchFor("Purchasable: Flour"));

            await waitFor(() => expect(mockUpdateProductSettings).toHaveBeenCalledTimes(1));
            expect(mockUpdateProductSettings).toHaveBeenCalledWith(1, {
                isInventory: true,
                isPurchasable: true,
                unit: "GRAMS",
                topVendor: "Old Supplier Co",
            });
        });

        it("names the vendor as the thing to fix when such a save is refused", async () => {
            mockUpdateProductSettings.mockRejectedValue(new Error("Top vendor must be one of the existing vendors"));
            render(<ProductsTable role={StaffRoles.MANAGER}/>);
            await screen.findByText("Flour");
            await waitFor(() => expect(screen.getByRole("combobox", {name: "Top vendor: Flour"}).textContent)
                .toBe("Old Supplier Co (unknown vendor)"));

            fireEvent.click(switchFor("Purchasable: Flour"));

            expect(await screen.findByText(
                "Couldn't save “Flour”: Top vendor must be one of the existing vendors. "
                + "Its top vendor “Old Supplier Co” matches no vendor — set Top vendor to a vendor or None first."
            )).toBeTruthy();
            expect(switchFor("Purchasable: Flour").checked).toBe(false);
        });
    });

    describe("adding a product", () => {
        it("opens the create form and puts the new product at the top of the table", async () => {
            const basil = product({id: 2, name: "Basil", price: null, topVendor: null, isInventory: false});
            mockCreateProduct.mockResolvedValue(basil);
            render(<ProductsTable role={StaffRoles.MANAGER}/>);
            await screen.findByText("Flour");

            fireEvent.click(screen.getByTestId("add-product"));
            fireEvent.change(await screen.findByLabelText("Name"), {target: {value: "Basil"}});
            fireEvent.change(screen.getByLabelText("Target price"), {target: {value: "7"}});
            fireEvent.mouseDown(within(screen.getByTestId("create-product-unit")).getByRole("combobox"));
            fireEvent.click(screen.getByRole("option", {name: "g"}));
            fireEvent.click(screen.getByTestId("create-product-submit"));

            expect(await screen.findByText("Basil")).toBeTruthy();
            expect(await screen.findByText("Added “Basil”")).toBeTruthy();
            const names = Array.from(document.querySelectorAll('.MuiDataGrid-row [data-field="name"]'))
                .map(cell => cell.textContent);
            expect(names).toEqual(["Basil", "Flour"]);
        });

        it("warns about a name already in the table before anything is sent", async () => {
            render(<ProductsTable role={StaffRoles.MANAGER}/>);
            await screen.findByText("Flour");

            fireEvent.click(screen.getByTestId("add-product"));
            fireEvent.change(await screen.findByLabelText("Name"), {target: {value: " FLOUR "}});

            expect(screen.getByText("A product with this name already exists")).toBeTruthy();
        });
    });
});
