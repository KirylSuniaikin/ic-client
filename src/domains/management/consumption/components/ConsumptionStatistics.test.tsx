import React from "react";
import "@testing-library/jest-dom";
import {render, screen, waitFor, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {ConsumptionStatistics} from "./ConsumptionStatistics";
import {fetchLatestConsumptionReport, fetchSpendHistory} from "../../../../shared/api/management";
import {ConsumptionReportTO, SpendHistoryTO} from "../types";

jest.mock("../../../../shared/api/management");
// The grid itself needs TextEncoder (absent in jsdom) and is not what is under test: rows are
// filtered before they reach it, so the stub only exposes how many rows it was handed.
jest.mock("@mui/x-data-grid", () => ({
    DataGrid: ({rows}: {rows: unknown[]}) => <div data-testid="grid-rows">{rows.length}</div>,
}));

const report: ConsumptionReportTO = {
    id: 1,
    title: "oct-26-consumption",
    branchNo: 1,
    userId: 1,
    finalPrice: 165.5,
    consumptionProducts: [
        {productName: "Mozzarella", spent: 100, quantity: 10, finalPrice: 100, vendorName: "Gulf Dairy"},
        {productName: "Mozzarella Light", spent: 20.5, quantity: 4, finalPrice: 20.5, vendorName: "Gulf Dairy"},
        {productName: "Flour", spent: 40, quantity: 8, finalPrice: 40, vendorName: "Mill Co"},
        {productName: "Napkins", spent: 5, quantity: 2, finalPrice: 5, vendorName: null},
    ],
};

const summary = () => within(screen.getByTestId("consumption-summary-row"));

async function renderLoaded() {
    (fetchLatestConsumptionReport as jest.Mock).mockResolvedValue(report);
    render(<ConsumptionStatistics branchId="b1"/>);
    await waitFor(() => expect(summary().getByText("165.500")).toBeInTheDocument());
}

async function pickVendor(option: string) {
    await userEvent.click(screen.getByRole("button", {name: "Filters"}));
    await userEvent.click(screen.getByRole("combobox", {name: "Vendor"}));
    await userEvent.click(await screen.findByRole("option", {name: option}));
}

describe("ConsumptionStatistics vendor summary", () => {
    it("keeps the vendor filter hidden until Filters is pressed", async () => {
        await renderLoaded();

        expect(screen.queryByRole("combobox", {name: "Vendor"})).toBeNull();
        await userEvent.click(screen.getByRole("button", {name: "Filters"}));
        expect(await screen.findByRole("combobox", {name: "Vendor"})).toBeTruthy();
    });

    it("clears the vendor filter from the summary chip", async () => {
        await renderLoaded();
        await pickVendor("Gulf Dairy");

        await userEvent.click(within(screen.getByTestId("consumption-summary-row")).getByTestId("CancelIcon"));

        expect(summary().getByText("All vendors")).toBeInTheDocument();
        expect(summary().getByText("4 items")).toBeInTheDocument();
    });

    it("totals every product while no vendor is chosen", async () => {
        await renderLoaded();

        expect(summary().getByText("4 items")).toBeInTheDocument();
        expect(summary().getByText("All vendors")).toBeInTheDocument();
        expect(screen.getByTestId("grid-rows")).toHaveTextContent("4");
    });

    it("totals only the chosen vendor's products", async () => {
        await renderLoaded();

        await pickVendor("Gulf Dairy");

        expect(summary().getByText("2 items")).toBeInTheDocument();
        expect(summary().getByText("Gulf Dairy")).toBeInTheDocument();
        expect(summary().getByText("120.500")).toBeInTheDocument();
        expect(screen.getByTestId("grid-rows")).toHaveTextContent("2");
    });

    it("totals the products that have no vendor", async () => {
        await renderLoaded();

        await pickVendor("No vendor");

        expect(summary().getByText("1 item")).toBeInTheDocument();
        expect(summary().getByText("5.000")).toBeInTheDocument();
    });

    it("narrows the total further when the name search is also used", async () => {
        await renderLoaded();

        await pickVendor("Gulf Dairy");
        await userEvent.type(screen.getByPlaceholderText("Type to filter"), "light");

        expect(summary().getByText("1 item")).toBeInTheDocument();
        expect(summary().getByText("20.500")).toBeInTheDocument();
    });
});

describe("ConsumptionStatistics spend history popup", () => {
    const history: SpendHistoryTO = {
        months: ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]
            .map((month, i) => ({month, spent: i === 5 ? 120 : 0})),
        products: [{
            productName: "Mozzarella",
            spent: 120,
            changePercent: 20,
            prices: ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]
                .map((month, i) => ({month, unitPrice: i === 0 ? 10 : i === 5 ? 12 : null})),
        }],
    };

    it("asks for the filtered vendor's history when the summary amount is pressed", async () => {
        (fetchSpendHistory as jest.Mock).mockResolvedValue(history);
        await renderLoaded();
        await pickVendor("Gulf Dairy");

        await userEvent.click(screen.getByRole("button", {name: "Show 6 month purchase history"}));

        expect(fetchSpendHistory).toHaveBeenCalledWith("b1", "Gulf Dairy", "");
        const dialog = await screen.findByRole("dialog");
        expect(await within(dialog).findByTestId("price-card")).toBeInTheDocument();
        expect(within(dialog).getByText("+20.0%")).toBeInTheDocument();
        expect(within(dialog).getAllByTestId("spend-bar")).toHaveLength(6);
    });
});
