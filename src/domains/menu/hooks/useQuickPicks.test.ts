import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { renderHook, waitFor } from "@testing-library/react";

jest.mock("../../../shared/api/public");

import { getQuickPicks } from "../../../shared/api/public";
import { useQuickPicks } from "./useQuickPicks";
import type { QuickPickDto } from "../types";

const mockGetQuickPicks = jest.mocked(getQuickPicks);

beforeEach(() => {
    mockGetQuickPicks.mockReset();
});

describe("useQuickPicks", () => {
    it("returns [] and skips the fetch when menuItemId is null", () => {
        const { result } = renderHook(() => useQuickPicks(null));
        expect(result.current).toEqual([]);
        expect(mockGetQuickPicks).not.toHaveBeenCalled();
    });

    it("returns [] and skips the fetch when menuItemId is undefined", () => {
        const { result } = renderHook(() => useQuickPicks(undefined));
        expect(result.current).toEqual([]);
        expect(mockGetQuickPicks).not.toHaveBeenCalled();
    });

    it("resolves to the fetched picks when getQuickPicks resolves", async () => {
        const picks: QuickPickDto[] = [{ id: 1, label: "No Tomato", labelAr: null, isPopular: false }];
        mockGetQuickPicks.mockResolvedValueOnce(picks);

        const { result } = renderHook(() => useQuickPicks(42));

        await waitFor(() => expect(result.current).toEqual(picks));
    });

    it("resolves to [] when getQuickPicks rejects", async () => {
        mockGetQuickPicks.mockRejectedValueOnce(new Error("network error"));

        const { result } = renderHook(() => useQuickPicks(42));

        await waitFor(() => expect(mockGetQuickPicks).toHaveBeenCalledWith(42));
        expect(result.current).toEqual([]);
    });
});
