import { jest, describe, it, expect, beforeEach, beforeAll, afterAll } from "@jest/globals";
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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

const table = () => screen.getByRole("table", { name: "accounting entries" });

// The load effect awaits two requests before the table renders. waitFor's 1s default
// is enough in isolation but times out under the parallel workers of a full-suite run,
// so give it room rather than leaving a load-dependent flake behind.
const findTable = () => waitFor(() => expect(table()).toBeTruthy(), { timeout: 10_000 });

beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ role: StaffRoles.SUPER_MANAGER, username: "amal" });
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
        it("shows the running-balance column for SUPER_MANAGER", async () => {
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
    });

    // The delete-button column has no visible heading, so it is easy to add body
    // cells without a matching header and skew every column below it.
    describe("column alignment", () => {
        it.each([
            [StaffRoles.SUPER_MANAGER, 10],
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
        it("appends a row on Add", async () => {
            renderPopup();
            await findTable();
            const before = screen.getAllByRole("row").length;

            fireEvent.click(screen.getByRole("button", { name: "Add" }));

            await waitFor(() =>
                expect(screen.getAllByRole("row").length).toBe(before + 1)
            );
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

            // Last combobox of the first row is its Category select (CREDIT row).
            const combos = screen.getAllByRole("combobox");
            fireEvent.mouseDown(combos[2]);

            await waitFor(() => expect(screen.getAllByRole("option").length).toBeGreaterThan(0));
            expect(screen.getByRole("option", { name: "Sales" })).toBeTruthy();
            expect(screen.queryByRole("option", { name: "Supplies" })).toBeNull();
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

            await pickPhotoOn(0);

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

            // Give the new row the category and amount that save validation requires.
            const amounts = screen.getAllByPlaceholderText("0");
            fireEvent.change(amounts[amounts.length - 1], { target: { value: "25" } });
            const combos = screen.getAllByRole("combobox");
            fireEvent.mouseDown(combos[combos.length - 1]);
            await settle(() => expect(screen.getByRole("option", { name: "Supplies" })).toBeTruthy());
            fireEvent.click(screen.getByRole("option", { name: "Supplies" }));

            await pickPhotoOn(2);

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
