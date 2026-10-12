import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { renderHook, waitFor, act } from "@testing-library/react";
import {
    createCatalogEntry,
    fetchDisciplineCatalog,
    fetchDisciplineSettings,
    updateCatalogEntry,
    updateDisciplineSettings,
} from "../../../../shared/api/management";
import type { CatalogCategoryTO, CatalogItemTO, DisciplineSettingsTO } from "../../discipline/types";
import { usePenaltyCatalog } from "./usePenaltyCatalog";

jest.mock("../../../../shared/api/management");

const mockCatalog = jest.mocked(fetchDisciplineCatalog);
const mockSettings = jest.mocked(fetchDisciplineSettings);
const mockCreate = jest.mocked(createCatalogEntry);
const mockUpdate = jest.mocked(updateCatalogEntry);
const mockPut = jest.mocked(updateDisciplineSettings);

const ITEM: CatalogItemTO = {
    id: 5, categoryId: 1, code: "1.1", title: "Late", violationClass: "B", points: 15, ttlDays: 180, penaltyHours: 2,
};
const CATEGORIES: CatalogCategoryTO[] = [{ id: 1, code: "1", name: "Attendance", correctiveMeasure: null, items: [ITEM] }];
const SETTINGS: DisciplineSettingsTO = { shadowPilot: false, updatedAt: null, updatedByName: null };

describe("usePenaltyCatalog", () => {
    beforeEach(() => {
        jest.resetAllMocks();
        mockCatalog.mockResolvedValue(CATEGORIES);
        mockSettings.mockResolvedValue(SETTINGS);
    });

    it("loads the catalog and the settings", async () => {
        const { result } = renderHook(() => usePenaltyCatalog());

        await waitFor(() => expect(result.current.settings).toEqual(SETTINGS));
        await waitFor(() => expect(result.current.categories).toEqual(CATEGORIES));
        expect(result.current.catalogError).toBeNull();
        expect(result.current.settingsError).toBeNull();
    });

    it("exposes a settings load failure", async () => {
        mockSettings.mockRejectedValue(new Error("settings down"));
        const { result } = renderHook(() => usePenaltyCatalog());

        await waitFor(() => expect(result.current.settingsError).toBe("settings down"));
        expect(result.current.settings).toBeNull();
    });

    it("exposes a catalog load failure", async () => {
        mockCatalog.mockRejectedValue(new Error("catalog down"));
        const { result } = renderHook(() => usePenaltyCatalog());

        await waitFor(() => expect(result.current.catalogError).toBe("catalog down"));
    });

    it("createEntry calls the API, refetches the catalog and returns the entry", async () => {
        mockCreate.mockResolvedValue(ITEM);
        const { result } = renderHook(() => usePenaltyCatalog());
        await waitFor(() => expect(result.current.categories).not.toBeNull());
        const req = { categoryId: 1, title: "Late", violationClass: "B" as const, points: 15, ttlDays: 180, penaltyHours: 2 };

        let returned: CatalogItemTO | undefined;
        await act(async () => {
            returned = await result.current.createEntry(req);
        });

        expect(mockCreate).toHaveBeenCalledWith(req);
        expect(returned).toEqual(ITEM);
        await waitFor(() => expect(mockCatalog).toHaveBeenCalledTimes(2));
    });

    it("updateEntry calls the API with id and refetches the catalog", async () => {
        mockUpdate.mockResolvedValue(ITEM);
        const { result } = renderHook(() => usePenaltyCatalog());
        await waitFor(() => expect(result.current.categories).not.toBeNull());
        const req = { violationClass: "C" as const, points: 25, ttlDays: 365, penaltyHours: 5 };

        await act(async () => {
            await result.current.updateEntry(5, req);
        });

        expect(mockUpdate).toHaveBeenCalledWith(5, req);
        await waitFor(() => expect(mockCatalog).toHaveBeenCalledTimes(2));
    });

    it("setShadowPilot sends the value and replaces settings from the response", async () => {
        const updated: DisciplineSettingsTO = { shadowPilot: true, updatedAt: "2026-10-08T10:00:00Z", updatedByName: "Ann" };
        mockPut.mockResolvedValue(updated);
        const { result } = renderHook(() => usePenaltyCatalog());
        await waitFor(() => expect(result.current.settings).toEqual(SETTINGS));

        await act(async () => {
            await result.current.setShadowPilot(true);
        });

        expect(mockPut).toHaveBeenCalledWith({ shadowPilot: true });
        expect(result.current.settings).toEqual(updated);
    });

    it("propagates mutation errors to the caller and does not refetch", async () => {
        mockCreate.mockRejectedValue(new Error("conflict"));
        mockUpdate.mockRejectedValue(new Error("bad"));
        mockPut.mockRejectedValue(new Error("forbidden"));
        const { result } = renderHook(() => usePenaltyCatalog());
        await waitFor(() => expect(result.current.settings).toEqual(SETTINGS));
        await waitFor(() => expect(result.current.categories).not.toBeNull());

        await expect(
            result.current.createEntry({ categoryId: 1, title: "x", violationClass: "D", points: 0, ttlDays: null, penaltyHours: 0 }),
        ).rejects.toThrow("conflict");
        await expect(
            result.current.updateEntry(5, { violationClass: "D", points: 0, ttlDays: null, penaltyHours: 0 }),
        ).rejects.toThrow("bad");
        await expect(result.current.setShadowPilot(true)).rejects.toThrow("forbidden");

        expect(mockCatalog).toHaveBeenCalledTimes(1);
        expect(result.current.settings).toEqual(SETTINGS);
    });
});
