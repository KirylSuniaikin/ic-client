import { jest, describe, it, expect, beforeEach, beforeAll } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PurchaseTablePopup } from "./PurchaseTablePopup";
import {
    fetchProducts,
    fetchVendors,
    getUser,
} from "../../../../shared/api/management";
import type { IBranch } from "../../inventory/types";

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/management.ts
jest.mock("../../../../shared/api/management");

// jsdom's test environment lacks crypto.randomUUID (used by mkEmptyRow).
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

describe("PurchaseTablePopup", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFetchProducts.mockResolvedValue([]);
        mockFetchVendors.mockResolvedValue([]);
        mockGetUser.mockResolvedValue({ id: 1, userName: "admin" });
    });

    it("renders a brand-new row's quantity and finalPrice cells as empty placeholders, not literal 0.000", async () => {
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

        // quantity + finalPrice cells for the single mkEmptyRow()
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
});
