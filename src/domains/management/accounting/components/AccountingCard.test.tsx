import { describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen } from "@testing-library/react";
import { AccountingCard } from "./AccountingCard";
import type { AccountingReportSummary } from "../types";

const base: AccountingReportSummary = {
    id: 1,
    title: "Aug-26",
    createdAt: "2026-08-01T10:00:00",
    version: 0,
    startBalance: null,
    totalIncome: 100,
    totalExpense: 40,
};

const summary = (over: Partial<AccountingReportSummary> = {}): AccountingReportSummary =>
    ({ ...base, ...over });

describe("AccountingCard", () => {
    it("shows the opening balance in place of the creation date when there is one", () => {
        // Where the month started is what an owner opens this list for. When it was created is an
        // audit detail, and it was occupying the only line the card has.
        render(<AccountingCard report={summary({ startBalance: 1234.5 })} onEditClick={() => {}} />);

        expect(screen.getByText(/Opening balance: 1234.5 BHD/)).toBeTruthy();
    });

    it("falls back to the creation date when the balance is withheld or was never recorded", () => {
        // Null means one of two things — not an OWNER, or a report predating the column — and
        // neither is "the month started at zero", which is what a 0.000 here would claim.
        render(<AccountingCard report={summary({ startBalance: null })} onEditClick={() => {}} />);

        expect(screen.queryByText(/Opening balance/)).toBeNull();
        expect(screen.getByText(new Date(base.createdAt).toLocaleDateString())).toBeTruthy();
    });

    it("still shows a zero opening balance rather than treating it as missing", () => {
        // A month that genuinely started at zero is information. Testing truthiness instead of
        // null here would hide it.
        render(<AccountingCard report={summary({ startBalance: 0 })} onEditClick={() => {}} />);

        expect(screen.getByText(/Opening balance: 0 BHD/)).toBeTruthy();
    });
});
