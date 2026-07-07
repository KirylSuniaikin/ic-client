import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import i18n from "../../../shared/i18n";

jest.mock("../../../shared/api/public");

import { getQuickPicks } from "../../../shared/api/public";
import { QuickPickChips } from "./QuickPickChips";
import type { QuickPickDto } from "../types";

const mockGetQuickPicks = jest.mocked(getQuickPicks);

const picks: QuickPickDto[] = [
    { id: 1, label: "Half BBQ Chicken Ranch", labelAr: null, isPopular: true },
    { id: 2, label: "No Tomato", labelAr: "بدون طماطم", isPopular: false },
];

function renderChips(
    selectedIds: number[] = [],
    onChange = jest.fn<void, [number[], string]>()
) {
    const utils = render(
        <QuickPickChips menuItemId={42} selectedIds={selectedIds} onChange={onChange} />
    );
    return { onChange, ...utils };
}

beforeEach(() => {
    mockGetQuickPicks.mockReset();
    i18n.changeLanguage("en");
});

describe("QuickPickChips", () => {
    it("renders null when getQuickPicks resolves with an empty array", async () => {
        mockGetQuickPicks.mockResolvedValueOnce([]);
        const { container } = await renderChips();

        await waitFor(() => expect(mockGetQuickPicks).toHaveBeenCalledWith(42));
        await waitFor(() => expect(container.firstChild).toBeNull());
    });

    it("renders chip labels once getQuickPicks resolves with data", async () => {
        mockGetQuickPicks.mockResolvedValueOnce(picks);
        await renderChips();

        expect(await screen.findByText("⭐ Half BBQ Chicken Ranch")).toBeTruthy();
        expect(await screen.findByText("No Tomato")).toBeTruthy();
    });

    it("clicking an unselected chip calls onChange with the id added and correct joined string", async () => {
        mockGetQuickPicks.mockResolvedValueOnce(picks);
        const { onChange } = await renderChips([1]);

        const chip = await screen.findByText("No Tomato");
        fireEvent.click(chip);

        expect(onChange).toHaveBeenCalledWith([1, 2], "Half BBQ Chicken Ranch, No Tomato");
    });

    it("clicking an already-selected chip calls onChange with the id removed", async () => {
        mockGetQuickPicks.mockResolvedValueOnce(picks);
        const { onChange } = await renderChips([1, 2]);

        const chip = await screen.findByText("No Tomato");
        fireEvent.click(chip);

        expect(onChange).toHaveBeenCalledWith([1], "Half BBQ Chicken Ranch");
    });

    it("displays the ⭐ prefix for a popular pick but omits it from the joined string", async () => {
        mockGetQuickPicks.mockResolvedValueOnce(picks);
        const { onChange } = await renderChips([]);

        const chip = await screen.findByText("⭐ Half BBQ Chicken Ranch");
        fireEvent.click(chip);

        expect(onChange).toHaveBeenCalledWith([1], "Half BBQ Chicken Ranch");
    });

    it("shows labelAr when i18n language is ar and labelAr is set", async () => {
        i18n.changeLanguage("ar");
        mockGetQuickPicks.mockResolvedValueOnce(picks);
        await renderChips();

        expect(await screen.findByText("بدون طماطم")).toBeTruthy();
    });

    it("falls back to label when i18n language is ar and labelAr is null", async () => {
        i18n.changeLanguage("ar");
        mockGetQuickPicks.mockResolvedValueOnce(picks);
        await renderChips();

        expect(await screen.findByText("⭐ Half BBQ Chicken Ranch")).toBeTruthy();
    });

    it("renders the header text using t(quickPicks.header) for en", async () => {
        mockGetQuickPicks.mockResolvedValueOnce(picks);
        const { unmount } = await renderChips();
        expect(await screen.findByText("Quick picks")).toBeTruthy();
        unmount();
    });

    it("renders the header text using t(quickPicks.header) for ar", async () => {
        i18n.changeLanguage("ar");
        mockGetQuickPicks.mockResolvedValueOnce(picks);
        await renderChips();
        expect(await screen.findByText("اختيارات سريعة")).toBeTruthy();
    });
});
