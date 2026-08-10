import { jest, describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen } from "@testing-library/react";
import { PurchaseCard } from "./PurchaseCard";
import type { BasePurchaseResponse } from "../types";

function report(overrides: Partial<BasePurchaseResponse> = {}): BasePurchaseResponse {
    return {
        id: 7,
        title: "jul-25-bh-admin",
        finalPrice: 120.5,
        createdAt: "2026-07-14T10:00:00",
        unpaidCount: 0,
        unpaidAmount: 0,
        ...overrides,
    };
}

describe("PurchaseCard unpaid badge", () => {
    it("shows the outstanding count and amount when the report has unpaid invoices", () => {
        render(<PurchaseCard report={report({ unpaidCount: 3, unpaidAmount: 412.5 })} onEditClick={jest.fn()} />);

        expect(screen.getByTestId("unpaid-badge-7").textContent).toBe("Unpaid 3 · 412.500");
    });

    it("renders no badge at all when nothing is outstanding", () => {
        render(<PurchaseCard report={report({ unpaidCount: 0, unpaidAmount: 0 })} onEditClick={jest.fn()} />);

        // A permanent "Unpaid 0" would train everyone to stop reading the badge.
        expect(screen.queryByTestId("unpaid-badge-7")).toBeNull();
    });

    it("still renders the title and total when the badge is absent", () => {
        render(<PurchaseCard report={report()} onEditClick={jest.fn()} />);

        expect(screen.getByText("jul-25-bh-admin")).toBeTruthy();
        // 3dp to match the unpaid chip beside it, not the raw server number.
        expect(screen.getByText("120.500 BHD")).toBeTruthy();
    });

    it("dates the report from createdAt", () => {
        render(<PurchaseCard report={report()} onEditClick={jest.fn()} />);

        expect(screen.getByText("14.07.2026")).toBeTruthy();
    });

    it("omits the date rather than printing 'Invalid Date' when createdAt is unusable", () => {
        render(<PurchaseCard report={report({ createdAt: "" })} onEditClick={jest.fn()} />);

        expect(screen.queryByText(/Invalid Date/)).toBeNull();
        expect(screen.getByText("120.500 BHD")).toBeTruthy();
    });
});
