import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PenaltiesView from "./PenaltiesView";
import { usePenaltyCatalog } from "../hooks/usePenaltyCatalog";
import type { UsePenaltyCatalogResult } from "../hooks/usePenaltyCatalog";
import type {
    CatalogCategoryTO,
    CatalogItemTO,
    CreateCatalogEntryRequest,
    UpdateCatalogEntryRequest,
} from "../../discipline/types";

jest.mock("../hooks/usePenaltyCatalog");

const mockHook = jest.mocked(usePenaltyCatalog);

const CATEGORIES: CatalogCategoryTO[] = [
    {
        id: 1, code: "2", name: "Food preparation", correctiveMeasure: "Always: correct or redo the product.",
        items: [{ id: 11, categoryId: 1, code: "2.1", title: "Wrong recipe", violationClass: "B", points: 15, ttlDays: 180, penaltyHours: 2 }],
    },
    {
        id: 2, code: "D", name: "Dismissal", correctiveMeasure: null,
        items: [{ id: 21, categoryId: 2, code: "D.1", title: "Theft", violationClass: "D", points: 0, ttlDays: null, penaltyHours: 0 }],
    },
];

function state(over: Partial<UsePenaltyCatalogResult> = {}): UsePenaltyCatalogResult {
    return {
        categories: CATEGORIES,
        loadingCatalog: false,
        catalogError: null,
        settings: { shadowPilot: false, updatedAt: null, updatedByName: null },
        settingsError: null,
        createEntry: jest.fn<Promise<CatalogItemTO>, [CreateCatalogEntryRequest]>().mockResolvedValue(CATEGORIES[0].items[0]),
        updateEntry: jest
            .fn<Promise<CatalogItemTO>, [number, UpdateCatalogEntryRequest]>()
            .mockResolvedValue(CATEGORIES[0].items[0]),
        setShadowPilot: jest.fn<Promise<void>, [boolean]>().mockResolvedValue(undefined),
        refresh: jest.fn(),
        ...over,
    };
}

describe("PenaltiesView", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockHook.mockReturnValue(state());
    });

    it("renders the switch, every category heading and its items", () => {
        render(<PenaltiesView />);

        expect(screen.getByRole("switch", { name: "Shadow pilot" })).toBeTruthy();
        expect(screen.getByText("2 · Food preparation")).toBeTruthy();
        expect(screen.getByText("D · Dismissal")).toBeTruthy();
        expect(screen.getByText("2.1 Wrong recipe")).toBeTruthy();
        expect(screen.getByText("D.1 Theft")).toBeTruthy();
    });

    it("shows the pilot-on indicator when the settings are ON and not when OFF", () => {
        mockHook.mockReturnValue(state({ settings: { shadowPilot: true, updatedAt: null, updatedByName: null } }));
        const { unmount } = render(<PenaltiesView />);
        expect(screen.getByText("Pilot mode is ON")).toBeTruthy();
        unmount();

        mockHook.mockReturnValue(state());
        render(<PenaltiesView />);
        expect(screen.queryByText("Pilot mode is ON")).toBeNull();
    });

    it("shows the corrective measure only where non-null", () => {
        render(<PenaltiesView />);

        expect(screen.getAllByText("Always: correct or redo the product.")).toHaveLength(1);
    });

    it("formats the values line for classes A-C and D", () => {
        render(<PenaltiesView />);

        expect(screen.getByText("Class B · 15 pts · 180 days · 2 h")).toBeTruthy();
        expect(screen.getByText("Class D")).toBeTruthy();
    });

    it("shows a spinner while loading", () => {
        mockHook.mockReturnValue(state({ categories: null, loadingCatalog: true }));
        render(<PenaltiesView />);

        expect(screen.getByRole("progressbar")).toBeTruthy();
    });

    it("shows the catalog error", () => {
        mockHook.mockReturnValue(state({ categories: null, catalogError: "Catalog failed" }));
        render(<PenaltiesView />);

        expect(screen.getByText("Catalog failed")).toBeTruthy();
    });

    it("shows the settings error", () => {
        mockHook.mockReturnValue(state({ settingsError: "Settings failed" }));
        render(<PenaltiesView />);

        expect(screen.getByText("Settings failed")).toBeTruthy();
    });

    it("opens the drawer pre-filled when Edit is clicked", async () => {
        render(<PenaltiesView />);

        await userEvent.click(screen.getByRole("button", { name: "Edit 2.1" }));

        expect(screen.getByText("Edit 2.1")).toBeTruthy();
        expect((screen.getByLabelText("Points") as HTMLInputElement).value).toBe("15");
    });

    it("opens the create drawer for the clicked category", async () => {
        render(<PenaltiesView />);

        const card = screen.getByText("2 · Food preparation").parentElement as HTMLElement;
        await userEvent.click(within(card).getByRole("button", { name: "Add entry" }));

        expect(screen.getByText("Add entry — Food preparation")).toBeTruthy();
    });
});
