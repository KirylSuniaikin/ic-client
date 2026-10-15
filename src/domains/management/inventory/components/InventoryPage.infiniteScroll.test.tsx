import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import ManagementPage from "./InventoryPage";
import { getReports } from "../../../../shared/api/management";
import type { IBranch, IManagementResponse, IUser } from "../types";

jest.mock("../../../../shared/api/management");

// The report editor is a heavy tree with its own suites; this file is about the report list.
jest.mock("./InventoryPopup", () => ({ __esModule: true, default: () => null }));

const branch: IBranch = {
    id: "branch-uuid",
    externalId: "ext-1",
    branchNo: 1,
    branchName: "Main",
    locale: "en",
};

const user: IUser = { id: 1, userName: "admin" };

function reports(n: number): IManagementResponse[] {
    return Array.from({ length: n }, (_, i) => ({
        id: i + 1,
        title: `report-${i + 1}`,
        finalPrice: 100,
        createdAt: "2026-07-14T10:00:00",
    })) as IManagementResponse[];
}

const renderPage = () =>
    render(<ManagementPage isOpen={true} onClose={jest.fn()} branch={branch} user={user} />);

// Each card renders its report title, so counting titles counts cards.
const cardCount = (): number => screen.queryAllByText(/^report-\d+$/).length;

describe("InventoryPage infinite scroll", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("renders only the first six reports and offers to load more", async () => {
        jest.mocked(getReports).mockResolvedValue(reports(20) as any);

        renderPage();

        await waitFor(() => expect(cardCount()).toBe(6));
        expect(screen.getByTestId("inventory-scroll-sentinel")).toBeTruthy();
    });

    it("renders everything with no sentinel when there are six or fewer", async () => {
        jest.mocked(getReports).mockResolvedValue(reports(5) as any);

        renderPage();

        await waitFor(() => expect(cardCount()).toBe(5));
        expect(screen.queryByTestId("inventory-scroll-sentinel")).toBeNull();
    });

    it("keeps the empty state when there are no reports at all", async () => {
        jest.mocked(getReports).mockResolvedValue([] as any);

        renderPage();

        expect(await screen.findByText("There are no reports")).toBeTruthy();
        expect(screen.queryByTestId("inventory-scroll-sentinel")).toBeNull();
    });
});
