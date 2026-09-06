import {describe, it, expect} from "@jest/globals";
import React from "react";
import {render, screen} from "@testing-library/react";
import {GlobalStatsCard} from "./GlobalStatsCard";
import type {StatsResponse} from "../../types";

// Unique Customers is the customer registry (every row in `customers`, all branches, contacts
// included) while ARPU divides by the customers who actually ordered and paid at the selected
// branch. They are intentionally different populations, so the card must render the two figures
// exactly as the backend sends them and never derive one from the other — a reader who divides
// revenue by the Unique Customers on screen will not get the ARPU beside it, and that is correct.
const baseStats: StatsResponse = {
    totalPickUpRevenue: 100,
    totalPickUpOrderCount: 5,
    newCustomerOrderedCount: 1,
    oldCustomerOrderedCount: 4,
    oldCstmrOrderCount: 4,
    unknownCustomerOrderCount: 0,
    arpu: 20,
    uniqueCustomersAllTime: 12043,
    repeatCustomersAllTime: 1894,
    averageOrderValueAllTime: 7.1,
    monthTotalCustomers: 10,
    retainedCustomers: 4,
    retentionPercentage: 40,
    doughUsageTOS: [],
    sellsByHour: [],
    totalTalabatOrders: 2,
    totalTalabatRevenue: 40,
    topProducts: [],
    totalKeetaOrders: 1,
    totalKeetaRevenue: 10,
    averagePrepTimeSeconds: 300,
};

describe("GlobalStatsCard", () => {
    it("renders the registry-sized Unique Customers figure verbatim", () => {
        render(<GlobalStatsCard stats={baseStats}/>);

        expect(screen.getByText("12043")).toBeTruthy();
    });

    it("renders ARPU independently of the Unique Customers figure", () => {
        render(<GlobalStatsCard stats={baseStats}/>);

        // 20.00, not 100/12043 — ARPU's denominator is the paying population, not the registry.
        expect(screen.getByText("20.00")).toBeTruthy();
    });

    it("labels Unique Customers and Repeat Customers as separate populations", () => {
        render(<GlobalStatsCard stats={baseStats}/>);

        expect(screen.getByText("Unique Customers")).toBeTruthy();
        expect(screen.getByText("Repeat Customers")).toBeTruthy();
        expect(screen.getByText("1894")).toBeTruthy();
    });
});
