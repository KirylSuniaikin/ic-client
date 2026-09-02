import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BusinessTab from "./BusinessTab";
import type { CategoryClassification } from "../../types";

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/management.ts. The hook runs for
// real, so the fetch -> classify -> refetch wiring is genuine.
jest.mock("../../../../../shared/api/management");

import { getBusinessCategories, updateCategoryClassification } from "../../../../../shared/api/management";

const mockGet = jest.mocked(getBusinessCategories);
const mockUpdate = jest.mocked(updateCategoryClassification);

const marketing: CategoryClassification = {
    id: 1, name: "Marketing", type: "DEBIT", pnlClass: null, kpiTag: null,
    entryCount: 12, lifetimeTotal: 4102.5,
};
const rent: CategoryClassification = {
    id: 2, name: "Rent", type: "DEBIT", pnlClass: "OPEX", kpiTag: "RENT",
    entryCount: 14, lifetimeTotal: 2521.54,
};

describe("BusinessTab", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGet.mockResolvedValue([marketing, rent]);
        mockUpdate.mockResolvedValue({ ...marketing, pnlClass: "OPEX" });
    });

    it("warns with the count and the amount when categories are unclassified", async () => {
        // The amount is the point: "6 unclassified" is ignorable, "4,102.500 BHD unclassified" is
        // not, and that spend is currently in no P&L total.
        render(<BusinessTab />);

        expect(await screen.findByText(/1 unclassified · 4,102.500 BHD/)).toBeTruthy();
    });

    it("reports success when everything is classified", async () => {
        mockGet.mockResolvedValue([rent]);

        render(<BusinessTab />);

        expect(await screen.findByText(/All 1 categories classified/)).toBeTruthy();
    });

    it("opens the drawer with a row per category when the button is pressed", async () => {
        render(<BusinessTab />);
        await screen.findByText(/1 unclassified/);

        await userEvent.click(screen.getByRole("button", { name: "Classify categories" }));

        expect(await screen.findByTestId("category-row-1")).toBeTruthy();
        expect(screen.getByTestId("category-row-2")).toBeTruthy();
    });

    it("patches only the chosen category and refetches when a class is picked", async () => {
        render(<BusinessTab />);
        await screen.findByText(/1 unclassified/);
        await userEvent.click(screen.getByRole("button", { name: "Classify categories" }));

        const row = await screen.findByTestId("category-row-1");
        await userEvent.click(within(row).getByRole("combobox", { name: /P&L class/i }));
        await userEvent.click(await screen.findByRole("option", { name: /Operating expense/ }));

        await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
        // kpiTag is carried through unchanged: the PATCH sets both fields, so sending only the one
        // that changed would silently clear the other.
        expect(mockUpdate).toHaveBeenCalledWith(1, { pnlClass: "OPEX", kpiTag: null });
        // Re-fetched rather than patched locally — the server owns the ordering.
        await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));
    });

    it("keeps rendering when the categories request fails", async () => {
        // Errors go to the logger and are never thrown at the UI, matching useStatistics.
        mockGet.mockRejectedValue(new Error("Response: 500"));

        render(<BusinessTab />);

        expect(await screen.findByText(/All 0 categories classified/)).toBeTruthy();
    });
});