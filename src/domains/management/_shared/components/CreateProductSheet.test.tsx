import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import CreateProductSheet from "./CreateProductSheet";
import type { CreateProductSheetProps, ExistingProduct } from "./CreateProductSheet";
import { createProduct } from "../../../../shared/api/management";
import { DuplicateProductNameError } from "../../inventory/types";
import type { ProductTO } from "../../inventory/types";
import type { VendorTO } from "../../purchases/types";

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/management.ts
jest.mock("../../../../shared/api/management");

const mockCreateProduct = jest.mocked(createProduct);

const VENDORS: VendorTO[] = [
    { id: 1, vendorName: "Acme" },
    { id: 2, vendorName: "Bahrain Foods" },
];

function created(overrides: Partial<ProductTO> = {}): ProductTO {
    return {
        id: 99,
        name: "Fresh Basil",
        targetPrice: 1.5,
        price: null,
        isInventory: true,
        isPurchasable: false,
        isBundle: false,
        topVendor: "Acme",
        unit: "GRAMS",
        ...overrides,
    };
}

function renderSheet(overrides: Partial<CreateProductSheetProps> = {}) {
    const onCreated = jest.fn<void, [ProductTO]>();
    const onClose = jest.fn<void, []>();
    const existingProducts: ExistingProduct[] = [];
    render(
        <CreateProductSheet
            open
            vendors={VENDORS}
            existingProducts={existingProducts}
            onCreated={onCreated}
            onClose={onClose}
            {...overrides}
        />
    );
    return { onCreated, onClose };
}

function pickFromSelect(testId: string, optionName: string): void {
    fireEvent.mouseDown(within(screen.getByTestId(testId)).getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: optionName }));
}

function submitButton(): HTMLButtonElement {
    // The testid lands on the <button> itself, whose `disabled` is what the tests read.
    const button = screen.getByTestId("create-product-submit");
    if (!(button instanceof HTMLButtonElement)) throw new Error("submit is not a button");
    return button;
}

function fillValidForm(name: string = "Fresh Basil"): void {
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: name } });
    fireEvent.change(screen.getByLabelText("Target price"), { target: { value: "1.5" } });
    pickFromSelect("create-product-unit", "g");
}

describe("CreateProductSheet", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockCreateProduct.mockResolvedValue(created());
    });

    describe("validation", () => {
        it("keeps Add product disabled until name, target price and unit are all filled", () => {
            renderSheet();

            expect(submitButton().disabled).toBe(true);

            fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Basil" } });
            fireEvent.change(screen.getByLabelText("Target price"), { target: { value: "2" } });
            expect(submitButton().disabled).toBe(true);

            pickFromSelect("create-product-unit", "pcs");
            expect(submitButton().disabled).toBe(false);
        });

        // Number("") is 0, which the server accepts -- a missing price would be saved as 0 silently.
        it("keeps Add product disabled while the target price is empty, even with name and unit filled", () => {
            renderSheet();

            fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Basil" } });
            pickFromSelect("create-product-unit", "g");
            fireEvent.click(submitButton());

            expect(submitButton().disabled).toBe(true);
            expect(mockCreateProduct).not.toHaveBeenCalled();
        });

        it("treats a whitespace-only name as missing", () => {
            renderSheet();

            fillValidForm("    ");

            expect(submitButton().disabled).toBe(true);
        });

        it("refuses to take a minus sign or a fourth decimal into the target price", () => {
            renderSheet();
            const price = screen.getByLabelText("Target price");

            fireEvent.change(price, { target: { value: "-1" } });
            expect((price as HTMLInputElement).value).toBe("");

            fireEvent.change(price, { target: { value: "1.2345" } });
            expect((price as HTMLInputElement).value).toBe("");
        });

        it("flags a target price above the server's limit", () => {
            renderSheet();

            fillValidForm();
            fireEvent.change(screen.getByLabelText("Target price"), { target: { value: "1000000" } });

            expect(screen.getByText("Between 0 and 999999.999")).toBeTruthy();
            expect(submitButton().disabled).toBe(true);
        });

        it("flags a name longer than 255 characters", () => {
            renderSheet();

            fillValidForm("x".repeat(256));

            expect(screen.getByText("Up to 255 characters")).toBeTruthy();
            expect(submitButton().disabled).toBe(true);
        });
    });

    describe("duplicate names", () => {
        it("flags an existing name at once, ignoring case and extra spaces", () => {
            renderSheet({ existingProducts: [{ name: "Fresh Basil", isPurchasable: true }] });

            fillValidForm("  fresh    BASIL ");

            expect(screen.getByText("A product with this name already exists")).toBeTruthy();
            expect(submitButton().disabled).toBe(true);
        });

        it("says the existing product is not purchasable when opened from a purchase", () => {
            renderSheet({
                lockPurchasable: true,
                existingProducts: [{ name: "Fresh Basil", isPurchasable: false }],
            });

            fillValidForm("Fresh Basil");

            expect(screen.getByText(/already exists, but it is not purchasable/)).toBeTruthy();
        });

        it("shows the server's 409 on the name field and does not report a creation", async () => {
            mockCreateProduct.mockRejectedValueOnce(new DuplicateProductNameError());
            const { onCreated } = renderSheet();

            fillValidForm();
            fireEvent.click(submitButton());

            expect(await screen.findByText("A product with this name already exists")).toBeTruthy();
            expect(onCreated).not.toHaveBeenCalled();
            expect(screen.queryByTestId("create-product-error")).toBeNull();
        });

        it("clears the server's 409 once the name is changed", async () => {
            mockCreateProduct.mockRejectedValueOnce(new DuplicateProductNameError());
            renderSheet();

            fillValidForm();
            fireEvent.click(submitButton());
            await screen.findByText("A product with this name already exists");

            fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Fresh Basil Leaves" } });

            expect(screen.queryByText("A product with this name already exists")).toBeNull();
            expect(submitButton().disabled).toBe(false);
        });
    });

    describe("submit", () => {
        it("sends the cleaned name and every field, then hands back the created product", async () => {
            const product = created();
            mockCreateProduct.mockResolvedValueOnce(product);
            const { onCreated } = renderSheet();

            fillValidForm("  Fresh   Basil ");
            pickFromSelect("create-product-vendor", "Acme");
            fireEvent.click(screen.getByLabelText("Inventory item"));
            fireEvent.click(submitButton());

            await waitFor(() => expect(onCreated).toHaveBeenCalledWith(product));
            expect(mockCreateProduct).toHaveBeenCalledWith({
                name: "Fresh Basil",
                targetPrice: 1.5,
                unit: "GRAMS",
                topVendor: "Acme",
                isInventory: true,
                isPurchasable: false,
            });
        });

        it("sends a null top vendor when None is left selected", async () => {
            renderSheet();

            fillValidForm();
            fireEvent.click(submitButton());

            await waitFor(() => expect(mockCreateProduct).toHaveBeenCalledTimes(1));
            expect(mockCreateProduct.mock.calls[0][0].topVendor).toBeNull();
        });

        it("shows any other server error in a banner", async () => {
            mockCreateProduct.mockRejectedValueOnce(new Error("Unknown vendor: Nobody"));
            const { onCreated } = renderSheet();

            fillValidForm();
            fireEvent.click(submitButton());

            expect((await screen.findByTestId("create-product-error")).textContent).toContain("Unknown vendor: Nobody");
            expect(onCreated).not.toHaveBeenCalled();
        });
    });

    describe("opened from a purchase line", () => {
        it("pre-fills the name and the invoice's vendor, matched case-insensitively", async () => {
            renderSheet({ initialName: "Basil", initialTopVendor: "acme" });

            expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Basil");
            expect(within(screen.getByTestId("create-product-vendor")).getByRole("combobox").textContent).toBe("Acme");

            fireEvent.change(screen.getByLabelText("Target price"), { target: { value: "2" } });
            pickFromSelect("create-product-unit", "g");
            fireEvent.click(submitButton());

            await waitFor(() => expect(mockCreateProduct).toHaveBeenCalledTimes(1));
            expect(mockCreateProduct.mock.calls[0][0].topVendor).toBe("Acme");
        });

        it("ignores an invoice vendor that matches no known vendor", () => {
            renderSheet({ initialTopVendor: "Somebody Else" });

            expect(within(screen.getByTestId("create-product-vendor")).getByRole("combobox").textContent).toBe("None");
        });

        it("locks Purchasable on and always sends it as true", async () => {
            renderSheet({ lockPurchasable: true });
            const purchasable = screen.getByLabelText("Purchasable") as HTMLInputElement;

            expect(purchasable.checked).toBe(true);
            expect(purchasable.disabled).toBe(true);

            fillValidForm();
            fireEvent.click(submitButton());

            await waitFor(() => expect(mockCreateProduct).toHaveBeenCalledTimes(1));
            expect(mockCreateProduct.mock.calls[0][0].isPurchasable).toBe(true);
        });
    });

    it("renders nothing of the form while closed", () => {
        renderSheet({ open: false });

        expect(screen.queryByTestId("create-product-sheet")).toBeNull();
    });

    describe("presentation", () => {
        afterEach(() => {
            // A leftover stub would flip every later test in this file to the phone layout.
            Reflect.deleteProperty(window, "matchMedia");
        });

        // jsdom implements no matchMedia, so useMediaQuery reads false (desktop) unless stubbed --
        // same convention as ResponsiveSheet.test.tsx.
        function stubMatchMedia(matches: boolean): void {
            Object.defineProperty(window, "matchMedia", {
                writable: true,
                configurable: true,
                value: (query: string) => ({
                    matches,
                    media: query,
                    onchange: null,
                    addListener: (): void => {},
                    removeListener: (): void => {},
                    addEventListener: (): void => {},
                    removeEventListener: (): void => {},
                    dispatchEvent: (): boolean => false,
                }),
            });
        }

        it("opens as a centred dialog on a wide screen", () => {
            stubMatchMedia(false);

            renderSheet();

            expect(document.querySelector(".MuiDialog-root")).toBeTruthy();
            expect(document.querySelector(".MuiDrawer-root")).toBeNull();
        });

        it("slides up as a bottom sheet on a phone", () => {
            stubMatchMedia(true);

            renderSheet();

            expect(document.querySelector(".MuiDrawer-root")).toBeTruthy();
            expect(screen.getByLabelText("Name")).toBeTruthy();
        });
    });
});
