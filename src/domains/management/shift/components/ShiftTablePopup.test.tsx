import { jest, describe, it, expect, beforeEach, beforeAll, afterAll } from "@jest/globals";
import React from "react";
import { act, render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import dayjs from "dayjs";

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/management.ts
jest.mock("../../../../shared/api/management");

import {
    createShiftReport,
    editShiftReport,
    getShiftReport,
    getStaffByBranch,
} from "../../../../shared/api/management";
import { ShiftTablePopup } from "./ShiftTablePopup";
import type { IBranch } from "../../inventory/types";
import type { BaseShiftResponse, ShiftEntryTO, ShiftReportTO, StaffOption } from "../types";

const mockGetStaff = jest.mocked(getStaffByBranch);
const mockGetReport = jest.mocked(getShiftReport);
const mockCreateReport = jest.mocked(createShiftReport);
const mockEditReport = jest.mocked(editShiftReport);

const BRANCH: IBranch = {
    id: "11111111-2222-3333-4444-555555555555",
    externalId: "ext-1",
    branchNo: 1,
    branchName: "Adliya",
    locale: "adl",
};

const STAFF: StaffOption[] = [
    { id: 1, username: "riley.cook", role: "COOK" },
    { id: 2, username: "zara.manager", role: "MANAGER" },
];

const SAVED: BaseShiftResponse = { id: 7, title: "sep-26-bh-adliya", branchNo: 1, totalHours: 25.5 };

function entry(overrides: Partial<ShiftEntryTO>): ShiftEntryTO {
    return {
        id: 1,
        shiftDate: "2026-09-01",
        startTime: null,
        endTime: null,
        totalHours: null,
        staffId: 1,
        staffUsername: "riley.cook",
        ...overrides,
    };
}

// Oldest first, as the backend returns them (ORDER BY shift_date ASC), with the same-date rows
// deliberately out of start-time order so the popup's own sort is what gets tested.
function report(): ShiftReportTO {
    return {
        id: 7,
        title: "sep-26-bh-adliya",
        totalHours: 25.5,
        creationTimeStamp: "2026-09-01",
        branchNo: 1,
        shifts: [
            entry({ id: 1, shiftDate: "2026-09-01", startTime: "10:00:00", endTime: "18:00:00", totalHours: 8, staffId: 1 }),
            entry({ id: 2, shiftDate: "2026-09-02", startTime: "12:00:00", endTime: "16:00:00", totalHours: 4, staffId: 2 }),
            entry({ id: 3, shiftDate: "2026-09-03", startTime: "09:00:00", endTime: "16:30:00", totalHours: 7.5, staffId: 1 }),
            entry({ id: 4, shiftDate: "2026-09-03", startTime: null, endTime: null, totalHours: null, staffId: 2 }),
            entry({ id: 5, shiftDate: "2026-09-03", startTime: "17:00:00", endTime: "23:00:00", totalHours: 6, staffId: 2 }),
        ],
    };
}

type PopupProps = React.ComponentProps<typeof ShiftTablePopup>;

function renderPopup(props: Partial<PopupProps> = {}): ReturnType<typeof render> {
    return render(
        <ShiftTablePopup
            open
            mode="edit"
            shiftReportId={7}
            branch={BRANCH}
            onClose={jest.fn()}
            onSaved={jest.fn()}
            {...props}
        />
    );
}

const table = (): HTMLElement => screen.getByRole("table", { name: "shift entries" });

function bodyRows(): HTMLTableRowElement[] {
    return Array.from(table().querySelectorAll<HTMLTableRowElement>("tbody tr"));
}

function dateInput(row: HTMLTableRowElement): HTMLInputElement {
    const input = row.querySelector<HTMLInputElement>('input[type="date"]');
    if (!input) throw new Error("row has no date input");
    return input;
}

function timeInputs(row: HTMLTableRowElement): HTMLInputElement[] {
    return Array.from(row.querySelectorAll<HTMLInputElement>('input[type="time"]'));
}

/** Each row as [shiftDate, startTime] in on-screen order. */
function rowOrder(): [string, string][] {
    return bodyRows().map((row): [string, string] => [dateInput(row).value, timeInputs(row)[0].value]);
}

/** The contributor shown in each row, in on-screen order. */
function staffOrder(): (string | null)[] {
    return bodyRows().map((row) => within(row).getByRole("combobox").textContent);
}

function reportWith(shifts: ShiftEntryTO[]): ShiftReportTO {
    return { ...report(), shifts };
}

function pickStaff(row: HTMLTableRowElement, username: string): void {
    fireEvent.mouseDown(within(row).getByRole("combobox"));
    fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: username }));
}

// The load effect awaits two requests before the table renders; waitFor's 1s default times out
// under the parallel workers of a full-suite run, so give it room.
const findRows = (count: number): Promise<void> =>
    waitFor(() => expect(bodyRows()).toHaveLength(count), { timeout: 10_000 });

const saveButton = (): HTMLButtonElement => screen.getByRole<HTMLButtonElement>("button", { name: "Save" });

// jsdom has no layout, so it does not implement scrollIntoView at all; record which element asked.
const scrolledElements: Element[] = [];
const originalScrollIntoView = Element.prototype.scrollIntoView;

beforeAll(() => {
    Element.prototype.scrollIntoView = function (this: Element): void {
        scrolledElements.push(this);
    };
});

afterAll(() => {
    Element.prototype.scrollIntoView = originalScrollIntoView;
});

beforeEach(() => {
    jest.clearAllMocks();
    scrolledElements.length = 0;
    mockGetStaff.mockResolvedValue(STAFF);
    mockGetReport.mockResolvedValue(report());
});

describe("ShiftTablePopup", () => {
    describe("row order", () => {
        it("shows the newest shift date first, and the latest start time first within a date", async () => {
            renderPopup();
            await findRows(5);

            expect(rowOrder()).toEqual([
                ["2026-09-03", "17:00"],
                ["2026-09-03", "09:00"],
                ["2026-09-03", ""],
                ["2026-09-02", "12:00"],
                ["2026-09-01", "10:00"],
            ]);
        });

        it("keeps rows with the same date and start time in the order the server sent them", async () => {
            mockGetReport.mockResolvedValue(reportWith([
                entry({ id: 1, shiftDate: "2026-09-01", startTime: "10:00:00", staffId: 2, staffUsername: "zara.manager" }),
                entry({ id: 2, shiftDate: "2026-09-02", startTime: "12:00:00", staffId: 1, staffUsername: "riley.cook" }),
                entry({ id: 3, shiftDate: "2026-09-02", startTime: "12:00:00", staffId: 2, staffUsername: "zara.manager" }),
            ]));
            renderPopup();
            await findRows(3);

            expect(rowOrder()).toEqual([
                ["2026-09-02", "12:00"],
                ["2026-09-02", "12:00"],
                ["2026-09-01", "10:00"],
            ]);
            expect(staffOrder()).toEqual(["riley.cook", "zara.manager", "zara.manager"]);
        });

        // The backend returns dateless shifts (ORDER BY shift_date ASC puts NULLs last); two of them
        // used to crash the sort and leave the report unopenable.
        it("opens a report holding two shifts with no date, listing them last", async () => {
            mockGetReport.mockResolvedValue(reportWith([
                entry({ id: 1, shiftDate: "2026-09-01", startTime: "10:00:00", staffId: 1 }),
                entry({ id: 2, shiftDate: null, startTime: "09:00:00", staffId: 2 }),
                entry({ id: 3, shiftDate: null, startTime: null, staffId: 1 }),
            ]));
            renderPopup();
            await findRows(3);

            expect(rowOrder()).toEqual([
                ["2026-09-01", "10:00"],
                ["", "09:00"],
                ["", ""],
            ]);
            expect(screen.queryByRole("alert")).toBeNull();
            expect(saveButton().disabled).toBe(false);
        });

        it("puts a row added with Add at the top and scrolls it into view", async () => {
            renderPopup();
            await findRows(5);

            fireEvent.click(screen.getByRole("button", { name: "Add" }));

            expect(rowOrder()).toEqual([
                [dayjs().format("YYYY-MM-DD"), ""],
                ["2026-09-03", "17:00"],
                ["2026-09-03", "09:00"],
                ["2026-09-03", ""],
                ["2026-09-02", "12:00"],
                ["2026-09-01", "10:00"],
            ]);
            expect(scrolledElements).toEqual([bodyRows()[0]]);
        });

        // A live sort would yank the row out from under the cursor mid-edit.
        it("does not reorder rows when a row's date is edited", async () => {
            renderPopup();
            await findRows(5);

            fireEvent.change(dateInput(bodyRows()[4]), { target: { value: "2026-09-30" } });

            expect(rowOrder()).toEqual([
                ["2026-09-03", "17:00"],
                ["2026-09-03", "09:00"],
                ["2026-09-03", ""],
                ["2026-09-02", "12:00"],
                ["2026-09-30", "10:00"],
            ]);
        });
    });

    describe("save", () => {
        it("disables Save while the save is pending and ignores taps on it", async () => {
            let resolveEdit: (value: BaseShiftResponse) => void = () => {};
            mockEditReport.mockImplementation(() => new Promise((resolve) => { resolveEdit = resolve; }));
            const onSaved = jest.fn<void, [BaseShiftResponse]>();
            const onClose = jest.fn<void, []>();
            renderPopup({ onSaved, onClose });
            await findRows(5);
            const save = saveButton();

            fireEvent.click(save);

            expect(save.disabled).toBe(true);
            expect(save.textContent).toBe("Saving...");
            fireEvent.click(save);
            expect(mockEditReport).toHaveBeenCalledTimes(1);

            await act(async () => {
                resolveEdit(SAVED);
            });

            expect(onSaved).toHaveBeenCalledWith(SAVED);
            expect(onClose).toHaveBeenCalledTimes(1);
        });

        // Both taps land inside one act(), so React has not yet re-rendered the button as disabled
        // when the second one fires -- only the synchronous in-flight guard can stop it. This is the
        // double submit that made the backend 500 on concurrent edits of one report.
        it("sends one edit when Save is tapped twice before the button re-renders", async () => {
            mockEditReport.mockImplementation(() => new Promise(() => {}));
            renderPopup();
            await findRows(5);
            const save = saveButton();

            act(() => {
                fireEvent.click(save);
                fireEvent.click(save);
            });

            expect(mockEditReport).toHaveBeenCalledTimes(1);
        });

        it("sends one create when Save is tapped twice on a new report", async () => {
            mockCreateReport.mockImplementation(() => new Promise(() => {}));
            renderPopup({ mode: "new", shiftReportId: undefined });
            await findRows(1);
            pickStaff(bodyRows()[0], "riley.cook");
            const save = saveButton();

            act(() => {
                fireEvent.click(save);
                fireEvent.click(save);
            });

            expect(mockCreateReport).toHaveBeenCalledTimes(1);
            expect(mockGetReport).not.toHaveBeenCalled();
        });

        // A failed load leaves the table empty, and an edit replaces the report's shifts wholesale:
        // saving it would erase every shift in the report.
        it("keeps Save disabled when the report fails to load", async () => {
            mockGetReport.mockRejectedValue(new Error("Response: 500"));
            renderPopup();
            await waitFor(() => expect(screen.getByText("Response: 500")).toBeTruthy(), { timeout: 10_000 });

            fireEvent.click(saveButton());

            expect(saveButton().disabled).toBe(true);
            expect(mockEditReport).not.toHaveBeenCalled();
        });

        // The guard must be released on failure, or one network error would lock Save for good.
        it("re-enables Save after a failed save so it can be retried", async () => {
            mockEditReport
                .mockRejectedValueOnce(new Error("Response: 500"))
                .mockResolvedValueOnce(SAVED);
            const onClose = jest.fn<void, []>();
            renderPopup({ onClose });
            await findRows(5);
            const save = saveButton();

            fireEvent.click(save);
            await waitFor(() => expect(screen.getByText("Response: 500")).toBeTruthy());
            expect(save.disabled).toBe(false);
            fireEvent.click(save);

            await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
            expect(mockEditReport).toHaveBeenCalledTimes(2);
        });

        // Order carries no meaning to the backend (each shift has its own date); the popup sends
        // rows in on-screen order, newest first, with an added row at the head.
        it("sends every row, in on-screen order, including a newly added one", async () => {
            mockEditReport.mockResolvedValue(SAVED);
            renderPopup();
            await findRows(5);
            fireEvent.click(screen.getByRole("button", { name: "Add" }));
            const added = bodyRows()[0];
            pickStaff(added, "riley.cook");
            fireEvent.change(timeInputs(added)[0], { target: { value: "08:00" } });
            fireEvent.change(timeInputs(added)[1], { target: { value: "12:00" } });

            fireEvent.click(saveButton());

            await waitFor(() => expect(mockEditReport).toHaveBeenCalledTimes(1));
            expect(mockEditReport.mock.calls[0][0]).toEqual({
                id: 7,
                title: "sep-26-bh-adliya",
                branchNo: 1,
                totalHours: 29.5,
                creationTimeStamp: "2026-09-01",
                shifts: [
                    { shiftDate: dayjs().format("YYYY-MM-DD"), startTime: "08:00", endTime: "12:00", totalHours: 4, staffId: 1 },
                    { shiftDate: "2026-09-03", startTime: "17:00", endTime: "23:00", totalHours: 6, staffId: 2 },
                    { shiftDate: "2026-09-03", startTime: "09:00", endTime: "16:30", totalHours: 7.5, staffId: 1 },
                    { shiftDate: "2026-09-03", startTime: null, endTime: null, totalHours: null, staffId: 2 },
                    { shiftDate: "2026-09-02", startTime: "12:00", endTime: "16:00", totalHours: 4, staffId: 2 },
                    { shiftDate: "2026-09-01", startTime: "10:00", endTime: "18:00", totalHours: 8, staffId: 1 },
                ],
            });
        });
    });
});
