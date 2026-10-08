import { jest, describe, it, expect, beforeEach, beforeAll, afterAll } from "@jest/globals";
import React from "react";
import { render, screen, waitFor, fireEvent, within, act } from "@testing-library/react";
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

// Dates only: the view tests are about the ORDER and SET of rows, and the times the entries carry
// would just make the expectations noisier without testing more.
const rowDates = (): string[] =>
    Array.from(document.querySelectorAll('input[type="datetime-local"]')).map(
        (el) => (el as HTMLInputElement).value.slice(0, 10)
    );

// Date and Amount sort from their label; the other three open a filter popover from theirs.
const ariaSort = (column: string): string | null | undefined =>
    (screen.queryByTestId(`header-sort-${column}`) ?? screen.getByTestId(`header-filter-${column}`))
        .closest("th")
        ?.getAttribute("aria-sort");

// Echoes back whatever the popup sent, assigning an id to rows that arrived without one.
function echoEntries(payloadEntries: Array<{ id?: number; clientRef?: string }>): AccountingEntryTO[] {
    return payloadEntries.map((e, i) => ({
        ...report().entries[0],
        id: e.id ?? 900 + i,
        clientRef: e.clientRef ?? null,
    }));
}

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

describe("column-header sort and filters", () => {
    // Debounce + portal transitions are comfortably fast alone but not under a parallel full run.
    const SLOW = { timeout: 10_000 };

    const closePopoverVia = async (el: HTMLElement): Promise<void> => {
        fireEvent.keyDown(el, { key: "Escape" });
        await waitFor(() => expect(document.querySelector(".MuiPopover-root")).toBeNull(), SLOW);
    };

    async function applyNoteFilter(text: string): Promise<void> {
        fireEvent.click(screen.getByRole("button", { name: "Filter description" }));
        const input = await screen.findByLabelText("Description contains");
        fireEvent.change(input, { target: { value: text } });
        await screen.findByTestId("chip-filter-note", undefined, SLOW);
        await closePopoverVia(input);
    }

    // A multiline field renders a hidden shadow <textarea> too; only the visible one is the input.
    const noteInput = (value: string): HTMLElement => {
        const visible = screen.getAllByDisplayValue(value).find((el) => el.getAttribute("aria-hidden") !== "true");
        if (!visible) throw new Error(`no visible note input showing "${value}"`);
        return visible;
    };

    const editNote = (from: string, to: string): void => {
        fireEvent.change(noteInput(from), { target: { value: to } });
    };

    const promptGone = (): Promise<void> =>
        waitFor(() => expect(screen.queryByTestId("unsaved-prompt")).toBeNull(), SLOW);

    /** Note filter "float" active (row 101 only) AND an unsaved edit on that row. */
    async function openDirtyFilteredView(): Promise<void> {
        renderPopup();
        await findTable();
        await applyNoteFilter("float");
        expect(rowDates()).toEqual(["2026-07-01"]);
        editNote("Morning float", "Morning float 2");
    }

    const removeChip = (testId: string): void => {
        const svg = screen.getByTestId(testId).querySelector("svg");
        if (!svg) throw new Error(`chip ${testId} has no delete icon`);
        fireEvent.click(svg);
    };

    describe("header controls", () => {
        it("sorts Date and Amount on click, and opens the filter on click for Description, Account and Category", async () => {
            renderPopup();
            await findTable();

            for (const column of ["date", "amount"]) {
                expect(screen.getByTestId(`header-sort-${column}`)).toBeTruthy();
            }
            for (const label of ["Filter description", "Filter account", "Filter category"]) {
                expect(screen.getByRole("button", { name: label })).toBeTruthy();
            }
            for (const column of ["note", "account", "category"]) {
                expect(screen.queryByTestId(`header-sort-${column}`)).toBeNull();
            }
        });

        it("the Description popover also sorts A to Z, Z to A, and off again", async () => {
            renderPopup();
            await findTable();

            fireEvent.click(screen.getByRole("button", { name: "Filter description" }));
            fireEvent.click(await screen.findByTestId("sort-asc"));
            await waitFor(() => expect(ariaSort("note")).toBe("ascending"), SLOW);
            await screen.findByTestId("chip-sort-note");

            fireEvent.click(screen.getByTestId("sort-desc"));
            await waitFor(() => expect(ariaSort("note")).toBe("descending"), SLOW);

            fireEvent.click(screen.getByTestId("sort-desc"));
            await waitFor(() => expect(ariaSort("note")).toBe("none"), SLOW);
        }, 30_000);

        it("keeps Contributor and Balance free of sort and filter controls, and the header at 10 cells", async () => {
            renderPopup();
            await findTable();

            expect(screen.getByText("Contributor").querySelector("button")).toBeNull();
            expect(screen.getByText("Balance").querySelector("button")).toBeNull();
            expect(screen.getAllByRole("row")[0].querySelectorAll("th").length).toBe(10);
        });

        it("cycles the Type header All -> Debit -> Credit -> All and filters the rows", async () => {
            renderPopup();
            await findTable();
            const cycle = screen.getByTestId("header-type-cycle");
            expect(cycle.textContent).toBe("Type: All");

            fireEvent.click(cycle);
            await waitFor(() => expect(cycle.textContent).toBe("Type: Debit"));
            expect(rowDates()).toEqual(["2026-07-02"]);

            fireEvent.click(cycle);
            await waitFor(() => expect(cycle.textContent).toBe("Type: Credit"));
            expect(rowDates()).toEqual(["2026-07-01"]);

            fireEvent.click(cycle);
            await waitFor(() => expect(cycle.textContent).toBe("Type: All"));
            expect(rowDates()).toEqual(["2026-07-02", "2026-07-01"]);
        });

        it("shows priority badges and orders the sort chips by priority once two columns are sorted", async () => {
            renderPopup();
            await findTable();

            fireEvent.click(screen.getByTestId("header-sort-amount"));

            await waitFor(() => expect(screen.getByTestId("header-sort-amount-badge").textContent).toBe("2"));
            expect(screen.getByTestId("header-sort-date-badge").textContent).toBe("1");
            const chipIds = Array.from(
                screen.getByTestId("filter-chips").querySelectorAll('[data-testid^="chip-sort-"]')
            ).map((el) => el.getAttribute("data-testid"));
            expect(chipIds).toEqual(["chip-sort-date", "chip-sort-amount"]);
            expect(screen.getByTestId("chip-sort-date").textContent).toBe("1 Date ↓");
        });
    });

    describe("filters", () => {
        it("filters by description after a debounce", async () => {
            renderPopup();
            await findTable();

            fireEvent.click(screen.getByRole("button", { name: "Filter description" }));
            fireEvent.change(await screen.findByLabelText("Description contains"), { target: { value: "MORNING" } });

            // Not yet: typing must not re-filter on every keystroke.
            expect(rowDates()).toEqual(["2026-07-02", "2026-07-01"]);
            await waitFor(() => expect(rowDates()).toEqual(["2026-07-01"]), SLOW);
            expect(screen.getByTestId("chip-filter-note").textContent).toBe("Description: “MORNING”");
        });

        it("filters by account, and None matches an entry with no account", async () => {
            mockGetReport.mockResolvedValue(
                report({
                    entries: report().entries.map((e) => (e.id === 102 ? { ...e, accountType: null } : e)),
                })
            );
            renderPopup();
            await findTable();

            fireEvent.click(screen.getByRole("button", { name: "Filter account" }));
            const cash = await screen.findByRole("checkbox", { name: "Cash" });
            fireEvent.click(cash);
            await waitFor(() => expect(rowDates()).toEqual(["2026-07-01"]), SLOW);

            fireEvent.click(screen.getByRole("checkbox", { name: "None" }));
            await waitFor(() => expect(rowDates()).toEqual(["2026-07-02", "2026-07-01"]), SLOW);
            expect(screen.getByTestId("chip-filter-accounts").textContent).toBe("Account: Cash, None (2)");

            fireEvent.click(cash);
            await waitFor(() => expect(rowDates()).toEqual(["2026-07-02"]), SLOW);
        }, 30_000);

        it("filters by category, with a search box that narrows only the option list", async () => {
            renderPopup();
            await findTable();

            fireEvent.click(screen.getByRole("button", { name: "Filter category" }));
            fireEvent.change(await screen.findByLabelText("Search options"), { target: { value: "sup" } });

            expect(screen.queryByRole("checkbox", { name: "Sales" })).toBeNull();
            expect(rowDates()).toEqual(["2026-07-02", "2026-07-01"]);

            fireEvent.click(screen.getByRole("checkbox", { name: "Supplies" }));
            await waitFor(() => expect(rowDates()).toEqual(["2026-07-02"]));
        });

        it("never hides a row that has not been saved yet", async () => {
            renderPopup();
            await findTable();
            fireEvent.click(screen.getByTestId("header-type-cycle")); // Debit: hides entry 101
            await waitFor(() => expect(rowDates()).toEqual(["2026-07-02"]));

            fireEvent.click(screen.getByRole("button", { name: "Add" }));

            await waitFor(() => expect(rowDates().length).toBe(2));
            expect(rowDates()).toContain(todayIso());
            expect(screen.getByTestId("showing-count").textContent).toBe("Showing 2 of 3");
        });

        it("keeps running balances identical with a filter active", async () => {
            renderPopup();
            await findTable();
            expect(screen.getByText("130.000")).toBeTruthy();

            fireEvent.click(screen.getByTestId("header-type-cycle"));

            await waitFor(() => expect(rowDates()).toEqual(["2026-07-02"]));
            expect(screen.getByText("130.000")).toBeTruthy();
            expect(screen.queryByText("150.000")).toBeNull();
        });

        it("sends every entry, in rows order, when saving with a filter active", async () => {
            mockUpdateReport.mockResolvedValue(report());
            renderPopup();
            await findTable();
            fireEvent.click(screen.getByTestId("header-type-cycle"));
            await waitFor(() => expect(rowDates()).toEqual(["2026-07-02"]));

            fireEvent.click(screen.getByRole("button", { name: "Save" }));

            await waitFor(() => expect(mockUpdateReport).toHaveBeenCalledTimes(1));
            const payload = mockUpdateReport.mock.calls[0][1];
            expect(payload.entries.map((e) => e.id)).toEqual([101, 102]);
            expect(payload.entries.map((e) => e.amount)).toEqual([50, 20]);
        });
    });

    describe("chips row", () => {
        it("is absent at load, appears for a filter, and disappears when the filter is removed", async () => {
            renderPopup();
            await findTable();
            expect(screen.queryByTestId("filter-chips")).toBeNull();

            fireEvent.click(screen.getByTestId("header-type-cycle"));
            await waitFor(() => expect(screen.getByTestId("chip-filter-type").textContent).toBe("Type: Debit"));
            expect(screen.getByTestId("showing-count").textContent).toBe("Showing 1 of 2");

            removeChip("chip-filter-type");
            await waitFor(() => expect(screen.queryByTestId("filter-chips")).toBeNull());
            expect(rowDates()).toEqual(["2026-07-02", "2026-07-01"]);
        });

        it("appears for a non-default sort, and removing the sort chip drops that sort", async () => {
            renderPopup();
            await findTable();

            fireEvent.click(screen.getByTestId("header-sort-amount"));
            await screen.findByTestId("chip-sort-amount");

            removeChip("chip-sort-amount");
            await waitFor(() => expect(screen.queryByTestId("filter-chips")).toBeNull());
            expect(ariaSort("amount")).toBe("none");
        });

        it("Clear all restores the default view", async () => {
            renderPopup();
            await findTable();
            fireEvent.click(screen.getByTestId("header-type-cycle"));
            fireEvent.click(screen.getByTestId("header-sort-amount"));
            await screen.findByTestId("chip-sort-amount");

            fireEvent.click(screen.getByTestId("clear-all"));

            await waitFor(() => expect(screen.queryByTestId("filter-chips")).toBeNull());
            expect(screen.getByTestId("header-type-cycle").textContent).toBe("Type: All");
            expect(ariaSort("date")).toBe("descending");
            expect(ariaSort("amount")).toBe("none");
            expect(rowDates()).toEqual(["2026-07-02", "2026-07-01"]);
        });
    });

    describe("unsaved edits under a filter", () => {
        it("keeps an edited row visible after the edit stops matching the filter", async () => {
            renderPopup();
            await findTable();
            await applyNoteFilter("float");
            expect(rowDates()).toEqual(["2026-07-01"]);

            editNote("Morning float", "Something else");

            expect(rowDates()).toEqual(["2026-07-01"]);
            expect(screen.queryByTestId("filters-empty-clear")).toBeNull();
        });
    });

    describe("empty state", () => {
        it("says the filters hide everything, spans every column, and Clear filters restores the rows", async () => {
            renderPopup();
            await findTable();
            await applyNoteFilter("zzz-no-match");

            const cell = screen.getByText("No entries match the filters").closest("td");
            expect(cell?.getAttribute("colspan")).toBe("10");
            expect(screen.queryByText(/No entries yet/)).toBeNull();

            fireEvent.click(screen.getByTestId("filters-empty-clear"));

            await waitFor(() => expect(rowDates()).toEqual(["2026-07-02", "2026-07-01"]));
        });

        it("spans 9 columns for a non-owner", async () => {
            mockUseAuth.mockReturnValue({ role: StaffRoles.MANAGER, username: "amal" });
            renderPopup();
            await findTable();
            fireEvent.click(screen.getByTestId("header-type-cycle")); // Debit
            fireEvent.click(screen.getByTestId("header-type-cycle")); // Credit
            fireEvent.click(screen.getByTestId("header-sort-date"));
            await applyNoteFilter("zzz-no-match");

            const cell = screen.getByText("No entries match the filters").closest("td");
            expect(cell?.getAttribute("colspan")).toBe("9");
        });
    });

    describe("unsaved-changes gate", () => {
        it("does not prompt at load or for a sort change on a clean report", async () => {
            renderPopup();
            await findTable();
            expect(screen.queryByTestId("unsaved-prompt")).toBeNull();

            fireEvent.click(screen.getByTestId("header-sort-amount"));

            await waitFor(() => expect(ariaSort("amount")).toBe("descending"));
            expect(screen.queryByTestId("unsaved-prompt")).toBeNull();
        });

        it("does not prompt for a freshly opened new report", async () => {
            renderPopup({ mode: "new", reportId: undefined });
            await findTable();

            fireEvent.click(screen.getByTestId("header-sort-amount"));

            await waitFor(() => expect(ariaSort("amount")).toBe("descending"));
            expect(screen.queryByTestId("unsaved-prompt")).toBeNull();
        });

        it("prompts instead of sorting when there are unsaved edits", async () => {
            renderPopup();
            await findTable();
            editNote("Morning float", "Morning float 2");

            fireEvent.click(screen.getByTestId("header-sort-amount"));

            await screen.findByTestId("unsaved-prompt");
            expect(ariaSort("amount")).toBe("none");
        });

        it("prompts instead of cycling the Type filter when there are unsaved edits", async () => {
            renderPopup();
            await findTable();
            editNote("Morning float", "Morning float 2");

            fireEvent.click(screen.getByTestId("header-type-cycle"));

            await screen.findByTestId("unsaved-prompt");
            expect(screen.getByTestId("header-type-cycle").textContent).toBe("Type: All");
        });

        it("dismissing a prompted Type cycle leaves the filter and the edits untouched", async () => {
            renderPopup();
            await findTable();
            editNote("Morning float", "Morning float 2");
            fireEvent.click(screen.getByTestId("header-type-cycle"));
            const prompt = await screen.findByTestId("unsaved-prompt");

            fireEvent.keyDown(prompt, { key: "Escape" });

            await promptGone();
            expect(screen.getByTestId("header-type-cycle").textContent).toBe("Type: All");
            expect(screen.queryByTestId("filter-chips")).toBeNull();
            expect(noteInput("Morning float 2")).toBeTruthy();
            expect(mockUpdateReport).not.toHaveBeenCalled();
        });

        it("prompts instead of applying a filter change when there are unsaved edits", async () => {
            renderPopup();
            await findTable();
            editNote("Morning float", "Morning float 2");

            fireEvent.click(screen.getByRole("button", { name: "Filter account" }));
            fireEvent.click(await screen.findByRole("checkbox", { name: "Cash" }));

            await screen.findByTestId("unsaved-prompt");
            expect(screen.queryByTestId("chip-filter-accounts")).toBeNull();
        }, 30_000);

        it("prompts instead of removing a chip", async () => {
            await openDirtyFilteredView();

            removeChip("chip-filter-note");

            await screen.findByTestId("unsaved-prompt");
            expect(screen.getByTestId("chip-filter-note")).toBeTruthy();
        });

        it("prompts instead of clearing everything", async () => {
            await openDirtyFilteredView();

            fireEvent.click(screen.getByTestId("clear-all"));

            await screen.findByTestId("unsaved-prompt");
            expect(screen.getByTestId("chip-filter-note")).toBeTruthy();
        });

        it("prompts instead of clearing the filters from the empty state", async () => {
            await openDirtyFilteredView();
            // Deleting the only matching row empties the view while leaving the report dirty.
            const deleteButtons = screen
                .getAllByRole("button")
                .filter((b) => b.textContent === "" && b.getAttribute("aria-label") === null);
            fireEvent.click(deleteButtons[deleteButtons.length - 1]);
            await screen.findByTestId("filters-empty-clear");

            fireEvent.click(screen.getByTestId("filters-empty-clear"));

            await screen.findByTestId("unsaved-prompt");
            expect(screen.getByTestId("chip-filter-note")).toBeTruthy();
        }, 30_000);

        it("Revert restores the saved rows and then applies the change", async () => {
            renderPopup();
            await findTable();
            editNote("Morning float", "Morning float 2");
            fireEvent.click(screen.getByTestId("header-sort-amount"));
            await screen.findByTestId("unsaved-prompt");

            fireEvent.click(screen.getByTestId("unsaved-revert"));

            await promptGone();
            expect(noteInput("Morning float")).toBeTruthy();
            expect(screen.queryByDisplayValue("Morning float 2")).toBeNull();
            expect(ariaSort("amount")).toBe("descending");
            expect(mockUpdateReport).not.toHaveBeenCalled();
        });

        it("dismissing with the close button applies nothing and keeps the edits", async () => {
            renderPopup();
            await findTable();
            editNote("Morning float", "Morning float 2");
            fireEvent.click(screen.getByTestId("header-sort-amount"));
            const prompt = await screen.findByTestId("unsaved-prompt");

            fireEvent.click(within(prompt).getByRole("button", { name: "Close" }));

            await promptGone();
            expect(ariaSort("amount")).toBe("none");
            expect(noteInput("Morning float 2")).toBeTruthy();
        });

        it("dismissing with Escape applies nothing", async () => {
            renderPopup();
            await findTable();
            editNote("Morning float", "Morning float 2");
            fireEvent.click(screen.getByTestId("header-sort-amount"));
            const prompt = await screen.findByTestId("unsaved-prompt");

            fireEvent.keyDown(prompt, { key: "Escape" });

            await promptGone();
            expect(ariaSort("amount")).toBe("none");
            expect(mockUpdateReport).not.toHaveBeenCalled();
        });

        it("reverts the Description box to the applied value when the prompt is dismissed", async () => {
            renderPopup();
            await findTable();
            editNote("Morning float", "Morning float 2");
            fireEvent.click(screen.getByRole("button", { name: "Filter description" }));
            fireEvent.change(await screen.findByLabelText("Description contains"), { target: { value: "abc" } });
            const prompt = await screen.findByTestId("unsaved-prompt", undefined, SLOW);

            fireEvent.click(within(prompt).getByRole("button", { name: "Close" }));

            await promptGone();
            expect((screen.getByLabelText("Description contains") as HTMLInputElement).value).toBe("");
            expect(screen.queryByTestId("chip-filter-note")).toBeNull();
        }, 30_000);
    });

    describe("saving from the prompt", () => {
        async function openPromptOverEditedAmount(newAmount: string): Promise<void> {
            fireEvent.change(screen.getByDisplayValue("20"), { target: { value: newAmount } });
            fireEvent.click(screen.getByTestId("header-sort-amount"));
            await screen.findByTestId("unsaved-prompt");
        }

        it("saves, stays open, takes the report back in and applies the pending change", async () => {
            mockUpdateReport.mockResolvedValue(report({ version: 4, startBalance: 500 }));
            const onClose = jest.fn();
            const onSaved = jest.fn();
            renderPopup({ onClose, onSaved });
            await findTable();
            await openPromptOverEditedAmount("25");

            fireEvent.click(screen.getByTestId("unsaved-save"));

            await waitFor(() => expect(ariaSort("amount")).toBe("descending"), SLOW);
            await promptGone();
            expect(onClose).not.toHaveBeenCalled();
            expect(onSaved).toHaveBeenCalledTimes(1);
            expect(screen.getByTestId("opening-balance").textContent).toContain("500.000");

            // Clean again: a change applies without a prompt.
            fireEvent.click(screen.getByTestId("header-sort-amount"));
            await waitFor(() => expect(ariaSort("amount")).toBe("ascending"));
            expect(screen.queryByTestId("unsaved-prompt")).toBeNull();

            // ...and the next save carries the version the first one returned.
            fireEvent.click(screen.getByRole("button", { name: "Save" }));
            await waitFor(() => expect(mockUpdateReport).toHaveBeenCalledTimes(2));
            expect(mockUpdateReport.mock.calls[1][1].version).toBe(4);
        }, 30_000);

        it("detects a new dirty state after a prompt save", async () => {
            mockUpdateReport.mockResolvedValue(report({ version: 4 }));
            renderPopup();
            await findTable();
            await openPromptOverEditedAmount("25");
            fireEvent.click(screen.getByTestId("unsaved-save"));
            await waitFor(() => expect(ariaSort("amount")).toBe("descending"), SLOW);
            await promptGone();

            fireEvent.change(screen.getByDisplayValue("25"), { target: { value: "26" } });
            fireEvent.click(screen.getByTestId("header-sort-date"));

            await screen.findByTestId("unsaved-prompt");
            expect(ariaSort("date")).toBe("descending");
        });

        it("promotes a new report to an edit: the second save updates, never creates again", async () => {
            mockCreateReport.mockImplementation(async (payload) => ({
                ...report({ id: 42, version: 1 }),
                entries: echoEntries(payload.entries),
            }));
            mockUpdateReport.mockImplementation(async (_id, payload) => ({
                ...report({ id: 42, version: 2 }),
                entries: echoEntries(payload.entries),
            }));
            renderPopup({ mode: "new", reportId: undefined });
            await findTable();

            fireEvent.change(screen.getByPlaceholderText("0"), { target: { value: "40" } });
            const combos = screen.getAllByRole("combobox");
            fireEvent.mouseDown(combos[combos.length - 1]);
            fireEvent.click(await screen.findByRole("option", { name: "Supplies" }));

            fireEvent.click(screen.getByTestId("header-sort-amount"));
            await screen.findByTestId("unsaved-prompt");
            fireEvent.click(screen.getByTestId("unsaved-save"));
            await waitFor(() => expect(ariaSort("amount")).toBe("descending"), SLOW);
            await promptGone();
            expect(mockCreateReport).toHaveBeenCalledTimes(1);

            fireEvent.change(screen.getByDisplayValue("40"), { target: { value: "41" } });
            fireEvent.click(screen.getByTestId("header-sort-date"));
            await screen.findByTestId("unsaved-prompt");
            fireEvent.click(screen.getByTestId("unsaved-save"));

            await waitFor(() => expect(mockUpdateReport).toHaveBeenCalledTimes(1), SLOW);
            expect(mockUpdateReport.mock.calls[0][0]).toBe(42);
            expect(mockUpdateReport.mock.calls[0][1].version).toBe(1);
            expect(mockCreateReport).toHaveBeenCalledTimes(1);
            expect(mockGetReport).not.toHaveBeenCalled();
        }, 30_000);

        it("closes the prompt, shows the error and applies nothing when the save fails", async () => {
            mockUpdateReport.mockRejectedValue(new Error("HTTP 500"));
            const onSaved = jest.fn();
            renderPopup({ onSaved });
            await findTable();
            await openPromptOverEditedAmount("25");

            fireEvent.click(screen.getByTestId("unsaved-save"));

            await waitFor(() => expect(screen.getByText("HTTP 500")).toBeTruthy(), SLOW);
            await promptGone();
            expect(ariaSort("amount")).toBe("none");
            expect(screen.getByDisplayValue("25")).toBeTruthy();
            expect(onSaved).not.toHaveBeenCalled();
        });

        it("treats a validation failure as a failed save", async () => {
            renderPopup();
            await findTable();
            await openPromptOverEditedAmount("0");

            fireEvent.click(screen.getByTestId("unsaved-save"));

            await waitFor(() =>
                expect(screen.getByText("Every row needs a category and a positive amount.")).toBeTruthy()
            );
            await promptGone();
            expect(mockUpdateReport).not.toHaveBeenCalled();
            expect(ariaSort("amount")).toBe("none");
            // The invalid edit is still there: nothing was reverted or replaced.
            expect(screen.getAllByDisplayValue("0").length).toBeGreaterThan(0);
        });

        it("treats a 409 as a failed save: prompt closes, the conflict message shows, nothing is applied", async () => {
            mockUpdateReport.mockRejectedValue(Object.assign(new Error("conflict"), { status: 409 }));
            const onSaved = jest.fn();
            renderPopup({ onSaved });
            await findTable();
            await openPromptOverEditedAmount("25");

            fireEvent.click(screen.getByTestId("unsaved-save"));

            await waitFor(
                () => expect(screen.getByText(/This report was modified by another user/)).toBeTruthy(),
                SLOW
            );
            await promptGone();
            expect(ariaSort("amount")).toBe("none");
            expect(screen.getByDisplayValue("25")).toBeTruthy();
            expect(onSaved).not.toHaveBeenCalled();
        });

        it("recomputes the displayed balances from the refreshed opening balance after a prompt save", async () => {
            mockUpdateReport.mockResolvedValue(report({ version: 4, startBalance: 500 }));
            renderPopup();
            await findTable();
            await openPromptOverEditedAmount("25");

            fireEvent.click(screen.getByTestId("unsaved-save"));
            await promptGone();

            // 500 + 50 (credit) = 550, then - 25 (edited debit) = 525.
            await waitFor(() => expect(screen.getByText("525.000")).toBeTruthy(), SLOW);
            expect(screen.getByText("550.000")).toBeTruthy();
        }, 30_000);

        it("after a promotion the normal Save button updates the created report and closes", async () => {
            mockCreateReport.mockImplementation(async (payload) => ({
                ...report({ id: 42, version: 1 }),
                entries: echoEntries(payload.entries),
            }));
            mockUpdateReport.mockImplementation(async (_id, payload) => ({
                ...report({ id: 42, version: 2 }),
                entries: echoEntries(payload.entries),
            }));
            const onClose = jest.fn();
            renderPopup({ mode: "new", reportId: undefined, onClose });
            await findTable();
            fireEvent.change(screen.getByPlaceholderText("0"), { target: { value: "40" } });
            const combos = screen.getAllByRole("combobox");
            fireEvent.mouseDown(combos[combos.length - 1]);
            fireEvent.click(await screen.findByRole("option", { name: "Supplies" }));
            fireEvent.click(screen.getByTestId("header-sort-amount"));
            await screen.findByTestId("unsaved-prompt");
            fireEvent.click(screen.getByTestId("unsaved-save"));
            await waitFor(() => expect(ariaSort("amount")).toBe("descending"), SLOW);
            await promptGone();
            expect(onClose).not.toHaveBeenCalled();

            fireEvent.click(screen.getByRole("button", { name: "Save" }));

            await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1), SLOW);
            expect(mockCreateReport).toHaveBeenCalledTimes(1);
            expect(mockUpdateReport).toHaveBeenCalledTimes(1);
            expect(mockUpdateReport.mock.calls[0][0]).toBe(42);
            expect(mockGetReport).not.toHaveBeenCalled();
        }, 30_000);

        describe("with a picked photo", () => {
            const PICKED = new File(["raw"], "receipt.jpg", { type: "image/jpeg" });
            // jsdom implements neither, and the thumbnail preview calls both once a photo is picked.
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

            beforeEach(() => {
                mockDownscale.mockResolvedValue(new Blob(["compressed"], { type: "image/jpeg" }));
                mockUploadImage.mockResolvedValue({ entryId: 1, contentType: "image/jpeg", sizeBytes: 10 });
                mockDeleteImage.mockResolvedValue(undefined);
                mockUpdateReport.mockImplementation(async (_id, payload) => ({
                    ...report(),
                    entries: echoEntries(payload.entries),
                }));
            });

            it("treats a photo failure during a prompt save as a failure: prompt closes, change not applied", async () => {
                const onClose = jest.fn();
                const onSaved = jest.fn();
                mockUploadImage.mockRejectedValue(new Error("network"));
                renderPopup({ onClose, onSaved });
                await findTable();
                const input = screen.getAllByTestId(/^entry-image-input-/)[0];
                const rowKey = input.getAttribute("data-testid")!.replace("entry-image-input-", "");
                fireEvent.change(input, { target: { files: [PICKED] } });
                await screen.findByTestId(`entry-image-thumb-${rowKey}`, undefined, SLOW);
                fireEvent.click(screen.getByTestId("header-sort-amount"));
                await screen.findByTestId("unsaved-prompt");

                fireEvent.click(screen.getByTestId("unsaved-save"));

                await waitFor(
                    () => expect(screen.getByText(/Report saved, but 1 photo\(s\) could not be uploaded/)).toBeTruthy(),
                    SLOW
                );
                await promptGone();
                expect(ariaSort("amount")).toBe("none");
                expect(onSaved).toHaveBeenCalledTimes(1);
                expect(onClose).not.toHaveBeenCalled();
            }, 30_000);

            it("takes the persisted report in after a photo failure, so the next view change needs no prompt", async () => {
                mockUploadImage.mockRejectedValue(new Error("network"));
                renderPopup();
                await findTable();
                const input = screen.getAllByTestId(/^entry-image-input-/)[0];
                const rowKey = input.getAttribute("data-testid")!.replace("entry-image-input-", "");
                fireEvent.change(input, { target: { files: [PICKED] } });
                await screen.findByTestId(`entry-image-thumb-${rowKey}`, undefined, SLOW);
                fireEvent.click(screen.getByTestId("header-sort-amount"));
                await screen.findByTestId("unsaved-prompt");
                fireEvent.click(screen.getByTestId("unsaved-save"));
                await promptGone();

                fireEvent.click(screen.getByTestId("header-sort-amount"));

                await waitFor(() => expect(ariaSort("amount")).toBe("descending"), SLOW);
                expect(screen.queryByTestId("unsaved-prompt")).toBeNull();
            }, 30_000);
        });
    });

    describe("windowing", () => {
        type ObserverCallback = (entries: { isIntersecting: boolean }[]) => void;
        let latestObserverCallback: ObserverCallback | null = null;

        class FakeIntersectionObserver {
            constructor(callback: ObserverCallback) {
                latestObserverCallback = callback;
            }
            observe(): void {}
            unobserve(): void {}
            disconnect(): void {}
        }

        function setObserver(value: unknown): void {
            Object.defineProperty(globalThis, "IntersectionObserver", {
                configurable: true,
                writable: true,
                value,
            });
        }

        it("sends the window back to the first page when the sort changes", async () => {
            setObserver(FakeIntersectionObserver);
            try {
                mockGetReport.mockResolvedValue(
                    report({
                        // 25 = one full page plus a short second one: enough to see the window
                        // grow and collapse, without paying to mount 40 editable rows.
                        entries: Array.from({ length: 25 }, (_, i) => ({
                            ...report().entries[0],
                            id: i + 1,
                            note: `entry ${i + 1}`,
                            occurredAt: `2026-06-${String((i % 28) + 1).padStart(2, "0")}T00:00:00`,
                        })),
                    })
                );
                renderPopup();
                await screen.findByTestId("accounting-entries-sentinel");
                expect(document.querySelectorAll("tbody tr").length).toBe(20);

                act(() => latestObserverCallback?.([{ isIntersecting: true }]));
                await waitFor(() => expect(document.querySelectorAll("tbody tr").length).toBe(25), SLOW);

                fireEvent.click(screen.getByTestId("header-sort-amount"));

                await waitFor(() => expect(document.querySelectorAll("tbody tr").length).toBe(20), SLOW);
            } finally {
                setObserver(undefined);
            }
        }, 30_000);
    });
});

describe("Save button label", () => {
    it("is an element inside the button, not a bare text node", async () => {
        renderPopup();
        await findTable();

        const label = screen.getByRole("button", { name: "Save" }).querySelector("span");

        expect(label?.textContent).toBe("Save");
    }, 30_000);
});
