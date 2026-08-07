import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";
import { prefixer } from "stylis";
import rtlPlugin from "stylis-plugin-rtl";
import { ThemeProvider, createTheme } from "@mui/material/styles";

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/management.ts
jest.mock("../../../../shared/api/management");

// The staff auth context decodes a JWT out of storage on mount; the popup only reads
// `role` + `username`, so stub the hook rather than standing up a real provider.
const mockUseAuth = jest.fn<{ role: StaffRoles | null; username: string | null }, []>();
jest.mock("../../../auth/context/AuthProvider", () => ({
    useAuth: () => mockUseAuth(),
}));

import {
    getAccountingCategories,
    getAccountingReport,
} from "../../../../shared/api/management";
import { StaffRoles } from "../../../auth/types";
import { AccountingReportPopup } from "./AccountingReportPopup";
import type { IBranch } from "../../inventory/types";
import type { AccountingCategoryTO, AccountingReportTO } from "../types";

const mockGetCategories = jest.mocked(getAccountingCategories);
const mockGetReport = jest.mocked(getAccountingReport);

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
const findTable = () => waitFor(() => expect(table()).toBeTruthy());

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
