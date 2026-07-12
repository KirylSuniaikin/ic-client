import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import InventoryPopup from "./InventoryPopup";
import { fetchProducts } from "../../../../shared/api/management";
import type { IBranch, IUser, ProductTO } from "../types";

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/management.ts
jest.mock("../../../../shared/api/management");

const mockFetchProducts = jest.mocked(fetchProducts);

const branch: IBranch = {
    id: "branch-uuid",
    externalId: "ext-1",
    branchNo: 1,
    branchName: "Main",
    locale: "en",
};

const author: IUser = { id: 1, userName: "admin" };

const product: ProductTO = {
    id: 1,
    name: "Mozzarella",
    targetPrice: 10,
    price: 5,
    isInventory: true,
    isPurchasable: true,
    isBundle: false,
    topVendor: "",
};

describe("InventoryPopup", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFetchProducts.mockResolvedValue([product]);
    });

    it("renders a freshly-seeded row's storageQuantity/kitchenQuantity cells as empty placeholders, not literal 0.000", async () => {
        render(
            <InventoryPopup
                open={true}
                mode="new"
                branch={branch}
                author={author}
                onClose={jest.fn()}
            />
        );

        const placeholders = await screen.findAllByPlaceholderText("0.000");

        expect(placeholders).toHaveLength(2);
        placeholders.forEach((el) => {
            expect((el as HTMLInputElement).value).toBe("");
        });
    });

    it("allows focusing and typing into a never-touched quantity cell without deleting anything first", async () => {
        render(
            <InventoryPopup
                open={true}
                mode="new"
                branch={branch}
                author={author}
                onClose={jest.fn()}
            />
        );

        const [storageInput] = await screen.findAllByPlaceholderText("0.000");

        fireEvent.focus(storageInput);
        expect((storageInput as HTMLInputElement).value).toBe("");

        fireEvent.change(storageInput, { target: { value: "3" } });
        expect((storageInput as HTMLInputElement).value).toBe("3");
    });

    it("leaves an untouched-but-focused cell empty on blur without typing, instead of reverting to literal 0.000", async () => {
        render(
            <InventoryPopup
                open={true}
                mode="new"
                branch={branch}
                author={author}
                onClose={jest.fn()}
            />
        );

        const [storageInput] = await screen.findAllByPlaceholderText("0.000");

        fireEvent.focus(storageInput);
        fireEvent.blur(storageInput);

        await waitFor(() => {
            expect((storageInput as HTMLInputElement).value).toBe("");
        });
    });

    it("commits a typed value on blur and displays it as a real (non-placeholder) value", async () => {
        render(
            <InventoryPopup
                open={true}
                mode="new"
                branch={branch}
                author={author}
                onClose={jest.fn()}
            />
        );

        const [storageInput] = await screen.findAllByPlaceholderText("0.000");

        fireEvent.focus(storageInput);
        fireEvent.change(storageInput, { target: { value: "3" } });
        fireEvent.blur(storageInput);

        await waitFor(() => {
            expect((storageInput as HTMLInputElement).value).toBe("3.000");
        });
    });
});
