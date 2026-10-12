import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { renderHook, waitFor, act } from "@testing-library/react";
import {
    fetchDisciplineCatalog,
    fetchMyDiscipline,
    fetchMyWorkSummary,
    fetchRosterScores,
    fetchStaffDiscipline,
} from "../../../../shared/api/management";
import { useDisciplineCatalog } from "./useDisciplineCatalog";
import { useMyDiscipline } from "./useMyDiscipline";
import { useMyWorkSummary } from "./useMyWorkSummary";
import { useRosterScores } from "./useRosterScores";
import { useStaffDiscipline } from "./useStaffDiscipline";
import { makeCategory, makeItem, makeRecord } from "../testFixtures";
import type { MyWorkSummaryTO, StaffDisciplineTO } from "../types";

jest.mock("../../../../shared/api/management");

const mockCatalog = jest.mocked(fetchDisciplineCatalog);
const mockRoster = jest.mocked(fetchRosterScores);
const mockStaff = jest.mocked(fetchStaffDiscipline);
const mockMine = jest.mocked(fetchMyDiscipline);
const mockSummary = jest.mocked(fetchMyWorkSummary);

const SUMMARY: MyWorkSummaryTO = {
    periodStart: "2026-09-25", periodEnd: "2026-10-24", totalHours: 10, totalCost: null, totalSalary: null,
};

beforeEach(() => {
    [mockCatalog, mockRoster, mockStaff, mockMine, mockSummary].forEach((m) => m.mockReset());
});

describe("useDisciplineCatalog", () => {
    it("loads the catalog", async () => {
        const cats = [makeCategory(1, [makeItem(1, "A")])];
        mockCatalog.mockResolvedValue(cats);

        const { result } = renderHook(() => useDisciplineCatalog());

        await waitFor(() => expect(result.current.categories).toEqual(cats));
        expect(mockCatalog).toHaveBeenCalledTimes(1);
    });

    it("surfaces an error", async () => {
        mockCatalog.mockRejectedValue(new Error("down"));

        const { result } = renderHook(() => useDisciplineCatalog());

        await waitFor(() => expect(result.current.error).toBe("down"));
    });
});

describe("useRosterScores", () => {
    it("calls the API with the branch id and indexes scores by staff id", async () => {
        mockRoster.mockResolvedValue([
            { staffId: 4, score: 80, zone: "YELLOW" },
            { staffId: 9, score: -12, zone: "RED" },
        ]);

        const { result } = renderHook(() => useRosterScores("branch-1"));

        await waitFor(() => expect(result.current.scores.size).toBe(2));
        expect(mockRoster).toHaveBeenCalledWith("branch-1");
        expect(result.current.scores.get(9)?.zone).toBe("RED");
    });

    it("has an empty map before data arrives", () => {
        mockRoster.mockReturnValue(new Promise(() => undefined));

        const { result } = renderHook(() => useRosterScores("branch-1"));

        expect(result.current.scores.size).toBe(0);
    });
});

describe("useStaffDiscipline", () => {
    it("makes no request for a null staff id", () => {
        const { result } = renderHook(() => useStaffDiscipline(null));

        expect(mockStaff).not.toHaveBeenCalled();
        expect(result.current).toMatchObject({ record: null, loading: false });
    });

    it("fetches the record for a staff id", async () => {
        mockStaff.mockResolvedValue(makeRecord({ staffId: 7 }));

        const { result } = renderHook(() => useStaffDiscipline(7));

        await waitFor(() => expect(result.current.record?.staffId).toBe(7));
        expect(mockStaff).toHaveBeenCalledWith(7);
    });

    it("drops the previous record when the id changes and ignores a late response for the old id", async () => {
        let resolveOld: (r: StaffDisciplineTO) => void = () => undefined;
        mockStaff.mockImplementation((id) =>
            id === 1
                ? new Promise<StaffDisciplineTO>((res) => { resolveOld = res; })
                : Promise.resolve(makeRecord({ staffId: id })));
        const { result, rerender } = renderHook(({ id }) => useStaffDiscipline(id), { initialProps: { id: 1 } });

        rerender({ id: 2 });

        expect(result.current.record).toBeNull();
        await waitFor(() => expect(result.current.record?.staffId).toBe(2));
        await act(async () => resolveOld(makeRecord({ staffId: 1 })));
        expect(result.current.record?.staffId).toBe(2);
    });
});

describe("useMyDiscipline", () => {
    it("makes no request when disabled", () => {
        const { result } = renderHook(() => useMyDiscipline(false));

        expect(mockMine).not.toHaveBeenCalled();
        expect(result.current.record).toBeNull();
    });

    it("fetches the caller's record when enabled", async () => {
        mockMine.mockResolvedValue(makeRecord({ displayName: "Me" }));

        const { result } = renderHook(() => useMyDiscipline(true));

        await waitFor(() => expect(result.current.record?.displayName).toBe("Me"));
        expect(mockMine).toHaveBeenCalledTimes(1);
    });
});

describe("useMyWorkSummary", () => {
    it("makes no request when disabled", () => {
        renderHook(() => useMyWorkSummary(false));

        expect(mockSummary).not.toHaveBeenCalled();
    });

    it("fetches the summary when enabled", async () => {
        mockSummary.mockResolvedValue(SUMMARY);

        const { result } = renderHook(() => useMyWorkSummary(true));

        await waitFor(() => expect(result.current.summary).toEqual(SUMMARY));
    });
});
