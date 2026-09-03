import { jest, describe, it, expect, beforeEach, beforeAll, afterAll } from "@jest/globals";
import React from "react";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";
import { prefixer } from "stylis";
import rtlPlugin from "stylis-plugin-rtl";
import { ThemeProvider, createTheme } from "@mui/material/styles";

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/management.ts
jest.mock("../../../../shared/api/management");
// No manual mock exists for this one, so the factoryless form automocks it; the photo tests
// then decide what compressing a picked file returns.
jest.mock("../../../../shared/utils/imageCompress");

// The staff auth context decodes a JWT out of storage on mount; the popup only reads
// `role` + `username`, so stub the hook rather than standing up a real provider.
const mockUseAuth = jest.fn<{ role: StaffRoles | null; username: string | null }, []>();
jest.mock("../../../auth/context/AuthProvider", () => ({
    useAuth: () => mockUseAuth(),
}));

import {
    createAccountingReport,
    deleteAccountingEntryImage,
    getAccountingCategories,
    getAccountingReport,
    updateAccountingReport,
    uploadAccountingEntryImage,
} from "../../../../shared/api/management";
import { downscaleImage } from "../../../../shared/utils/imageCompress";
import { PreResponseNetworkError } from "../../../../shared/api/client";
import { StaffRoles } from "../../../auth/types";
import { AccountingReportPopup } from "./AccountingReportPopup";
import type { IBranch } from "../../inventory/types";
import type { AccountingCategoryTO, AccountingEntryTO, AccountingReportTO } from "../types";

const mockGetCategories = jest.mocked(getAccountingCategories);
const mockGetReport = jest.mocked(getAccountingReport);
const mockCreateReport = jest.mocked(createAccountingReport);
const mockUpdateReport = jest.mocked(updateAccountingReport);
const mockUploadImage = jest.mocked(uploadAccountingEntryImage);
const mockDeleteImage = jest.mocked(deleteAccountingEntryImage);
const mockDownscale = jest.mocked(downscaleImage);

const BRANCH: IBranch = {
    id: "11111111-2222-3333-4444-555555555555",
    externalId: "ext-1",
    branchNo: 1,
    branchName: "Adliya",
    locale: "adl",
};

const CATEGORIES: AccountingCategoryTO[] = [
    { id: 1, name: "Sales", type: "CREDIT" },
    { id: 2, name: "Supplies", type: "DEBIT" },
];

function report(overrides: Partial<AccountingReportTO> = {}): AccountingReportTO {
    return {
        id: 7,
        title: "july-adl",
        createdAt: "2026-07-01T10:00:00",
        version: 3,
        // Absent by default so existing tests keep exercising the deriveBaseBalance fallback;
        // tests that care about the persisted value override it explicitly.
        startBalance: null,
        entries: [
            {
                id: 101,
                categoryId: 1,
                categoryName: "Sales",
                type: "CREDIT",
                amount: 50,
                accountType: "CASH",
                occurredAt: "2026-07-01T00:00:00",
                note: "Morning float",
                contributorName: "amal",
                runningBalance: 150,
                hasImage: false,
            },
            {
                id: 102,
                categoryId: 2,
                categoryName: "Supplies",
                type: "DEBIT",
                amount: 20,
                accountType: "DEBIT_CARD",
                occurredAt: "2026-07-02T00:00:00",
                note: null,
                contributorName: "amal",
                runningBalance: 130,
                hasImage: true,
            },
        ],
        ...overrides,
    };
}

type PopupProps = React.ComponentProps<typeof AccountingReportPopup>;

// Mirrors the real cache wiring in app/providers.tsx. The popup styles a
// `& input::placeholder` selector, which is the one branch of stylis' prefixer that
// re-enters the tokenizer — so it only survives when the prefixer and @emotion/cache
// share a single stylis instance. Rendering bare (no CacheProvider) skips the custom
// plugin chain entirely and would not catch a regression here.
function renderPopup(
    props: Partial<PopupProps> = {},
    dir: "ltr" | "rtl" = "ltr"
) {
    const cache =
        dir === "rtl"
            ? createCache({ key: "muirtl", stylisPlugins: [prefixer, rtlPlugin] })
            : createCache({ key: "mui", stylisPlugins: [prefixer] });

    return render(
        <CacheProvider value={cache}>
            <ThemeProvider theme={createTheme({ direction: dir })}>
                <AccountingReportPopup
                    open
                    mode="edit"
                    reportId={7}
                    branch={BRANCH}
                    onClose={jest.fn()}
                    onSaved={jest.fn()}
                    {...props}
                />
            </ThemeProvider>
        </CacheProvider>
    );
}

function todayIso(): string {
    return new Date().toISOString().slice(0, 10);
}

const table = () => screen.getByRole("table", { name: "accounting entries" });

// The load effect awaits two requests before the table renders. waitFor's 1s default
// is enough in isolation but times out under the parallel workers of a full-suite run,
// so give it room rather than leaving a load-dependent flake behind.
const findTable = () => waitFor(() => expect(table()).toBeTruthy(), { timeout: 10_000 });

beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ role: StaffRoles.OWNER, username: "amal" });
    mockGetCategories.mockResolvedValue(CATEGORIES);
    mockGetReport.mockResolvedValue(report());
});

describe("AccountingReportPopup", () => {
    describe("styling pipeline", () => {
        it("renders under the LTR emotion cache", async () => {
            renderPopup();
            await findTable();
            expect(screen.getByDisplayValue("july-adl")).toBeTruthy();
        });

        it("renders under the RTL emotion cache", async () => {
            renderPopup({}, "rtl");
            await findTable();
            expect(screen.getByDisplayValue("july-adl")).toBeTruthy();
        });
    });

    describe("loading", () => {
        it("loads an existing report in edit mode", async () => {
            renderPopup();
            await findTable();

            expect(mockGetReport).toHaveBeenCalledWith(7);
            expect(mockGetCategories).toHaveBeenCalledWith(BRANCH.id);
            expect(screen.getByDisplayValue("Morning float")).toBeTruthy();
        });

        it("seeds a single blank row in new mode without fetching a report", async () => {
            renderPopup({ mode: "new", reportId: undefined });
            await findTable();

            expect(mockGetReport).not.toHaveBeenCalled();
            // header row + one seeded entry row
            expect(screen.getAllByRole("row").length).toBe(2);
        });

        it("names a new report after the CURRENT month even when today is day 1-3 (no rollback, unlike Inventory)", async () => {
            // try/finally (rather than a bare useRealTimers() as the last statement) so a failed
            // assertion still restores real timers — otherwise every later test in this file
            // would inherit fake timers and the 10s waitFor in findTable would cascade timeouts.
            jest.useFakeTimers();
            try {
                jest.setSystemTime(new Date("2026-07-02T09:00:00"));

                renderPopup({ mode: "new", reportId: undefined });
                await findTable();

                // dateFormatter("-", "en", false) -> "jul-26", then + "-" + branch.locale.toUpperCase().
                // Inventory's own call site (unaffected by this fix) would have rolled this back to
                // "jun-26-...".
                expect(screen.getByDisplayValue(/^jul-26-ADL$/)).toBeTruthy();
            } finally {
                jest.useRealTimers();
            }
        });

        it("survives a report payload with no entries", async () => {
            mockGetReport.mockResolvedValue(
                report({ entries: undefined as unknown as AccountingReportTO["entries"] })
            );
            renderPopup();
            await findTable();

            expect(screen.getByText(/No entries yet/)).toBeTruthy();
        });

        it("survives a non-array categories payload", async () => {
            mockGetCategories.mockResolvedValue(null as unknown as AccountingCategoryTO[]);
            renderPopup();
            await findTable();

            expect(screen.getByDisplayValue("july-adl")).toBeTruthy();
        });
    });

    describe("role-based columns", () => {
        it("shows the running-balance column for OWNER", async () => {
            renderPopup();
            await findTable();

            expect(screen.getByText("Balance")).toBeTruthy();
            // baseBalance derived from the first entry: 150 - 50 = 100, then +50, -20
            expect(screen.getByText("150.000")).toBeTruthy();
            expect(screen.getByText("130.000")).toBeTruthy();
        });

        it("hides the running-balance column for MANAGER", async () => {
            mockUseAuth.mockReturnValue({ role: StaffRoles.MANAGER, username: "amal" });
            renderPopup();
            await findTable();

            expect(screen.queryByText("Balance")).toBeNull();
        });

        it("hides the running-balance column for SUPER_MANAGER", async () => {
            mockUseAuth.mockReturnValue({ role: StaffRoles.SUPER_MANAGER, username: "amal" });
            renderPopup();
            await findTable();

            expect(screen.queryByText("Balance")).toBeNull();
        });
    });

    describe("opening balance display", () => {
        it("prefers the persisted startBalance over the deriveBaseBalance reconstruction for OWNER", async () => {
            // The fixture's entries would reconstruct to 100 (150 running balance - 50 credit on
            // the first entry) — deliberately different from the persisted 500 below, so a pass
            // here proves the real value is shown, not the reconstruction.
            mockGetReport.mockResolvedValue(report({ startBalance: 500 }));
            renderPopup();
            await findTable();

            expect(screen.getByTestId("opening-balance").textContent).toContain("500.000");
        });

        it("falls back to deriveBaseBalance's reconstruction for a legacy report with startBalance null", async () => {
            mockGetReport.mockResolvedValue(report({ startBalance: null }));
            renderPopup();
            await findTable();

            // 150 (first entry's running balance) - 50 (its CREDIT amount) = 100.
            expect(screen.getByTestId("opening-balance").textContent).toContain("100.000");
        });

        it("never renders the opening-balance display for a non-owner", async () => {
            mockUseAuth.mockReturnValue({ role: StaffRoles.MANAGER, username: "amal" });
            mockGetReport.mockResolvedValue(report({ startBalance: 500 }));
            renderPopup();
            await findTable();

            expect(screen.queryByTestId("opening-balance")).toBeNull();
        });
    });

    // The delete-button column has no visible heading, so it is easy to add body
    // cells without a matching header and skew every column below it.
    describe("column alignment", () => {
        it.each([
            [StaffRoles.OWNER, 10],
            [StaffRoles.SUPER_MANAGER, 9],
            [StaffRoles.MANAGER, 9],
        ])("head and body agree for %s", async (role, expected) => {
            mockUseAuth.mockReturnValue({ role, username: "amal" });
            renderPopup();
            await findTable();

            const [headerRow, ...bodyRows] = screen.getAllByRole("row");
            expect(headerRow.querySelectorAll("th").length).toBe(expected);
            bodyRows.forEach((r) =>
                expect(r.querySelectorAll("td").length).toBe(expected)
            );
        });

        it("spans the empty-state message across every column", async () => {
            mockGetReport.mockResolvedValue(
                report({ entries: undefined as unknown as AccountingReportTO["entries"] })
            );
            renderPopup();
            await findTable();

            const cell = screen.getByText(/No entries yet/).closest("td");
            expect(cell?.getAttribute("colspan")).toBe("10");
        });
    });

    describe("row editing", () => {
        it("adds a new row to the top of the table (both count and order)", async () => {
            renderPopup();
            await findTable();
            const before = screen.getAllByRole("row").length;

            fireEvent.click(screen.getByRole("button", { name: "Add" }));

            await waitFor(() =>
                expect(screen.getAllByRole("row").length).toBe(before + 1)
            );

            // rows()[0] is the header row; the freshly added row must render first, not last —
            // a brand-new row's date defaults to today, which sorts first under the newest-first
            // default.
            const firstBodyRow = screen.getAllByRole("row")[1];
            const dateInput = firstBodyRow.querySelector('input[type="date"]') as HTMLInputElement;
            expect(dateInput.value).toBe(todayIso());
        });

        it("adds a new row to the top of the table for a non-owner too (computedRows skips recomputeBalances, but sortedRows still applies)", async () => {
            // MANAGER never goes through recomputeBalances (isOwner is false), so computedRows is
            // the raw `rows` array unsorted by date — this exercises that sortedRows alone (not
            // the owner-only balance-sort pass) is what puts a fresh row on top for every role.
            mockUseAuth.mockReturnValue({ role: StaffRoles.MANAGER, username: "amal" });
            renderPopup();
            await findTable();
            const before = screen.getAllByRole("row").length;

            fireEvent.click(screen.getByRole("button", { name: "Add" }));

            await waitFor(() =>
                expect(screen.getAllByRole("row").length).toBe(before + 1)
            );

            const firstBodyRow = screen.getAllByRole("row")[1];
            const dateInput = firstBodyRow.querySelector('input[type="date"]') as HTMLInputElement;
            expect(dateInput.value).toBe(todayIso());
        });

        it("keeps the save payload in true insertion order even though the newest same-date row displays first", async () => {
            // Regression test: addRow() used to prepend into `rows`, which handleSave sends to
            // the backend verbatim as the entries payload. The backend sorts entries by
            // occurredAt with a STABLE sort, so same-date entries are tie-broken by array
            // order -- prepending silently reversed that tie-break and swapped every same-day
            // report's running balances (row1 created first must still be entries[0], even
            // though it displays SECOND once row2 is added).
            mockCreateReport.mockResolvedValue(report());
            renderPopup({ mode: "new", reportId: undefined });
            await findTable();

            // Category is the LAST combobox within a row (Type, Account, Category, in that
            // order) -- scope to the row element itself rather than a page-wide combobox
            // index, since that index shifts once a second row is added.
            async function fillRow(rowIndex: number, amount: string): Promise<void> {
                const row = screen.getAllByRole("row")[rowIndex];
                fireEvent.change(within(row).getByPlaceholderText("0"), { target: { value: amount } });
                const combos = within(row).getAllByRole("combobox");
                fireEvent.mouseDown(combos[combos.length - 1]);
                await waitFor(() => expect(screen.getByRole("option", { name: "Supplies" })).toBeTruthy());
                fireEvent.click(screen.getByRole("option", { name: "Supplies" }));
            }

            // Row 1 (created first, the only row so far): amount 40.
            await fillRow(1, "40");

            // Row 2 (added second, same default today's-date -- displays FIRST under the
            // newest-first default sort, so it's row index 1 and row1 shifts to index 2).
            fireEvent.click(screen.getByRole("button", { name: "Add" }));
            await waitFor(() => expect(screen.getAllByRole("row").length).toBe(3));
            await fillRow(1, "99");

            fireEvent.click(screen.getByRole("button", { name: "Save" }));
            await waitFor(() => expect(mockCreateReport).toHaveBeenCalledTimes(1));

            // Insertion order (row1 first, row2 second) -- NOT display order (row2, row1).
            expect(mockCreateReport.mock.calls[0][0].entries.map((e) => e.amount)).toEqual([40, 99]);
        });

        it("removes a row on delete", async () => {
            renderPopup();
            await findTable();
            const before = screen.getAllByRole("row").length;

            // Delete buttons are the only unlabelled icon buttons inside the table body.
            const deleteButtons = screen
                .getAllByRole("button")
                .filter((b) => b.textContent === "" && b.getAttribute("aria-label") === null);
            fireEvent.click(deleteButtons[deleteButtons.length - 1]);

            await waitFor(() =>
                expect(screen.getAllByRole("row").length).toBe(before - 1)
            );
        });

        it("offers only categories matching the row type", async () => {
            renderPopup();
            await findTable();

            // Newest-first default puts entry 102 (07-02, DEBIT) first and entry 101
            // (07-01, CREDIT) second — its Category select is the second row's last combobox.
            const combos = screen.getAllByRole("combobox");
            fireEvent.mouseDown(combos[5]);

            await waitFor(() => expect(screen.getAllByRole("option").length).toBeGreaterThan(0));
            expect(screen.getByRole("option", { name: "Sales" })).toBeTruthy();
            expect(screen.queryByRole("option", { name: "Supplies" })).toBeNull();
        });

        it("toggles the date sort between newest-first (default) and oldest-first", async () => {
            renderPopup();
            await findTable();

            const rowDates = () =>
                Array.from(document.querySelectorAll('input[type="date"]')).map(
                    (el) => (el as HTMLInputElement).value
                );

            expect(rowDates()).toEqual(["2026-07-02", "2026-07-01"]);

            fireEvent.click(screen.getByTestId("sort-toggle"));
            await waitFor(() => expect(rowDates()).toEqual(["2026-07-01", "2026-07-02"]));

            fireEvent.click(screen.getByTestId("sort-toggle"));
            await waitFor(() => expect(rowDates()).toEqual(["2026-07-02", "2026-07-01"]));
        });
    });

    // A receipt photo per entry, mirroring purchase invoices. The whole design hangs on entry ids
    // surviving a save: the photo is keyed by entry id, and a row added in this session has no id
    // until the response comes back, which is what clientRef is for.
    describe("entry photos", () => {
        const PICKED = new File(["raw"], "receipt.jpg", { type: "image/jpeg" });

        // jsdom implements neither, and the thumbnail preview calls both the moment a photo is
        // picked — without these the whole tree unmounts and every query below fails opaquely.
        const originalCreate = (globalThis.URL as any).createObjectURL;
        const originalRevoke = (globalThis.URL as any).revokeObjectURL;

        beforeAll(() => {
            (globalThis.URL as any).createObjectURL = (): string => "blob:accounting-test";
            (globalThis.URL as any).revokeObjectURL = (): void => undefined;
        });

        afterAll(() => {
            (globalThis.URL as any).createObjectURL = originalCreate;
            (globalThis.URL as any).revokeObjectURL = originalRevoke;
        });

        // Same reason findTable is generous: these interactions are comfortably fast in isolation
        // but not under the parallel workers of a full-suite run, and a load-dependent flake is
        // worse than a slow test.
        const SLOW = { timeout: 10_000 };
        const settle = (assertion: () => void) => waitFor(assertion, SLOW);

        async function pickPhotoOn(index: number): Promise<void> {
            const inputs = screen.getAllByTestId(/^entry-image-input-/);
            const rowKey = inputs[index].getAttribute("data-testid")!.replace("entry-image-input-", "");
            fireEvent.change(inputs[index], { target: { files: [PICKED] } });
            // Compression is async. Waiting only for downscaleImage to be CALLED races the state
            // update that follows it, so a Save fired straight after would read a row with no
            // pending blob. The thumbnail is proof the blob actually reached row state.
            await screen.findByTestId(`entry-image-thumb-${rowKey}`, undefined, SLOW);
        }

        // Echoes back whatever the popup sent, assigning an id to rows that arrived without one —
        // exactly what the backend does, and the only way the test can learn a new row's key.
        function echoSavedEntries(payloadEntries: Array<{ id?: number; clientRef?: string }>): AccountingEntryTO[] {
            return payloadEntries.map((e, i) => ({
                ...report().entries[0],
                id: e.id ?? 900 + i,
                clientRef: e.clientRef ?? null,
            }));
        }

        beforeEach(() => {
            mockDownscale.mockResolvedValue(new Blob(["compressed"], { type: "image/jpeg" }));
            mockUploadImage.mockResolvedValue({ entryId: 1, contentType: "image/jpeg", sizeBytes: 10 });
            mockDeleteImage.mockResolvedValue(undefined);
            mockUpdateReport.mockImplementation(async (_id, payload) => ({
                ...report(),
                entries: echoSavedEntries(payload.entries),
            }));
        });

        it("offers an upload control on an entry with no photo and a view control on one that has it", async () => {
            renderPopup();
            await findTable();

            expect(screen.getAllByLabelText("upload entry photo")).toHaveLength(1);
            expect(screen.getAllByLabelText("view entry photo")).toHaveLength(1);
        });

        it("sends every row's id so the server updates entries in place instead of re-creating them", async () => {
            renderPopup();
            await findTable();

            fireEvent.click(screen.getByRole("button", { name: "Save" }));

            await settle(() => expect(mockUpdateReport).toHaveBeenCalledTimes(1));
            const payload = mockUpdateReport.mock.calls[0][1];
            expect(payload.entries.map((e) => e.id)).toEqual([101, 102]);
            // Without a clientRef a photo on a brand-new row could never find its assigned id.
            payload.entries.forEach((e) => expect(typeof e.clientRef).toBe("string"));
        });

        it("uploads a photo picked on an existing entry against that entry's id", async () => {
            renderPopup();
            await findTable();

            // Newest-first default puts entry 102 (which already has a photo) first; entry 101
            // (no photo yet) is second.
            await pickPhotoOn(1);

            fireEvent.click(screen.getByRole("button", { name: "Save" }));

            await settle(() => expect(mockUploadImage).toHaveBeenCalledTimes(1));
            expect(mockUploadImage.mock.calls[0][0]).toBe(101);
            expect(mockUploadImage.mock.calls[0][1]).toBeInstanceOf(Blob);
        });

        it("uploads a photo picked on a row added in this session against the id the save assigned", async () => {
            renderPopup();
            await findTable();

            fireEvent.click(screen.getByRole("button", { name: "Add" }));
            await settle(() => expect(screen.getAllByRole("row").length).toBe(4));

            // The new row's date defaults to today, which sorts first under the newest-first
            // default — give the FIRST row the category and amount that save validation requires.
            const amounts = screen.getAllByPlaceholderText("0");
            fireEvent.change(amounts[0], { target: { value: "25" } });
            const combos = screen.getAllByRole("combobox");
            fireEvent.mouseDown(combos[2]);
            await settle(() => expect(screen.getByRole("option", { name: "Supplies" })).toBeTruthy());
            fireEvent.click(screen.getByRole("option", { name: "Supplies" }));

            await pickPhotoOn(0);

            fireEvent.click(screen.getByRole("button", { name: "Save" }));

            await settle(() => expect(mockUploadImage).toHaveBeenCalledTimes(1));
            const payload = mockUpdateReport.mock.calls[0][1];
            const newRowIndex = payload.entries.findIndex((e) => e.id == null);
            expect(newRowIndex).toBeGreaterThanOrEqual(0);
            expect(mockUploadImage.mock.calls[0][0]).toBe(900 + newRowIndex);
        }, 30_000);

        it("deletes a stored photo that was cleared before saving", async () => {
            renderPopup();
            await findTable();

            fireEvent.click(screen.getByLabelText("remove entry photo"));
            fireEvent.click(screen.getByRole("button", { name: "Save" }));

            await settle(() => expect(mockDeleteImage).toHaveBeenCalledTimes(1));
            // Entry 102 is the one carrying hasImage in the fixture.
            expect(mockDeleteImage.mock.calls[0][0]).toBe(102);
            expect(mockUploadImage).not.toHaveBeenCalled();
        });

        it("reports a failed photo without claiming the save failed, and stays open", async () => {
            const onClose = jest.fn();
            // Both the call and its one retry fail.
            mockUploadImage.mockRejectedValue(new Error("network"));
            renderPopup({ onClose });
            await findTable();

            await pickPhotoOn(0);
            fireEvent.click(screen.getByRole("button", { name: "Save" }));

            await waitFor(() =>
                expect(screen.getByText(/Report saved, but 1 photo\(s\) could not be uploaded/)).toBeTruthy()
            );
            expect(onClose).not.toHaveBeenCalled();
        });

        it("closes once the report and every photo have gone through", async () => {
            const onClose = jest.fn();
            renderPopup({ onClose });
            await findTable();

            fireEvent.click(screen.getByRole("button", { name: "Save" }));

            await settle(() => expect(onClose).toHaveBeenCalledTimes(1));
        });

        it("sends a clientRef on create so a photo on a first-ever row can be uploaded", async () => {
            mockCreateReport.mockImplementation(async (payload) => ({
                ...report(),
                entries: echoSavedEntries(payload.entries),
            }));
            renderPopup({ mode: "new", reportId: undefined });
            await findTable();

            const amounts = screen.getAllByPlaceholderText("0");
            fireEvent.change(amounts[0], { target: { value: "40" } });
            const combos = screen.getAllByRole("combobox");
            fireEvent.mouseDown(combos[combos.length - 1]);
            await settle(() => expect(screen.getByRole("option", { name: "Supplies" })).toBeTruthy());
            fireEvent.click(screen.getByRole("option", { name: "Supplies" }));

            await pickPhotoOn(0);
            fireEvent.click(screen.getByRole("button", { name: "Save" }));

            await settle(() => expect(mockUploadImage).toHaveBeenCalledTimes(1));
            expect(mockCreateReport.mock.calls[0][0].entries[0].clientRef).toEqual(expect.any(String));
            expect(mockUploadImage.mock.calls[0][0]).toBe(900);
        }, 30_000);
    });

    describe("save retry", () => {
        it("retries once after a network-level failure and saves successfully", async () => {
            // No HTTP response at all on the first attempt (offline / DNS failure / fetch
            // rejection inside authFetch) — PreResponseNetworkError is what authFetch itself
            // throws for that case, distinct from a plain Error surfacing a received response.
            mockUpdateReport
                .mockRejectedValueOnce(new PreResponseNetworkError(new Error("Failed to fetch")))
                .mockResolvedValueOnce(report());
            const onSaved = jest.fn();
            renderPopup({ onSaved });
            await findTable();

            fireEvent.click(screen.getByRole("button", { name: "Save" }));

            await waitFor(() => expect(mockUpdateReport).toHaveBeenCalledTimes(2));
            await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
        });

        it("does not retry a request that received an HTTP error response", async () => {
            mockUpdateReport.mockRejectedValue(new Error("HTTP 500"));
            const onSaved = jest.fn();
            renderPopup({ onSaved });
            await findTable();

            fireEvent.click(screen.getByRole("button", { name: "Save" }));

            await waitFor(() => expect(screen.getByText("HTTP 500")).toBeTruthy());
            expect(mockUpdateReport).toHaveBeenCalledTimes(1);
            expect(onSaved).not.toHaveBeenCalled();
        });

        it("shows the network-error message and stops after exactly two attempts when the retry also fails", async () => {
            // Both the initial attempt and the retry are pre-response network failures.
            mockUpdateReport.mockRejectedValue(new PreResponseNetworkError(new Error("Failed to fetch")));
            const onSaved = jest.fn();
            renderPopup({ onSaved });
            await findTable();

            fireEvent.click(screen.getByRole("button", { name: "Save" }));

            await waitFor(() =>
                expect(
                    screen.getByText("Network error — please check your connection and try saving again.")
                ).toBeTruthy()
            );
            expect(mockUpdateReport).toHaveBeenCalledTimes(2);
            expect(onSaved).not.toHaveBeenCalled();
        });
    });

    describe("validation", () => {
        it("blocks save when the title is empty", async () => {
            const onSaved = jest.fn();
            renderPopup({ onSaved });
            await findTable();

            fireEvent.change(screen.getByDisplayValue("july-adl"), { target: { value: "  " } });
            fireEvent.click(screen.getByRole("button", { name: "Save" }));

            await waitFor(() =>
                expect(screen.getByText("Report title is required.")).toBeTruthy()
            );
            expect(onSaved).not.toHaveBeenCalled();
        });
    });
});
