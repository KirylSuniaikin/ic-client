import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { IBranch } from "../../inventory/types";
import type { BranchScopeResult } from "../../_shared/hooks/useBranchScope";
import type { BranchBalanceResponse, CashUpdateRequest } from "../types";
import { PreResponseNetworkError } from "../../../../shared/api/client";

// Factory mocks: the shared manual mock of management.ts does not export these functions.
// The mock- prefix lets the hoisted factories reference them lazily.
const mockCashUpdate = jest.fn<Promise<Response>, [CashUpdateRequest]>();
const mockGetBranchBalance = jest.fn<Promise<BranchBalanceResponse>, [string]>();
const mockUseBranchScope = jest.fn<BranchScopeResult, [IBranch]>();
jest.mock("../../../../shared/api/management", () => ({
    cashUpdate: (payload: CashUpdateRequest) => mockCashUpdate(payload),
    getBranchBalance: (branchId: string) => mockGetBranchBalance(branchId),
}));
jest.mock("../../_shared/hooks/useBranchScope", () => ({
    useBranchScope: (fallback: IBranch) => mockUseBranchScope(fallback),
}));
jest.mock("./TransactionDetailsTable", () => ({ __esModule: true, default: () => null }));

import CashRegisterPopup from "./CashRegisterPopup";

// Only the fields the popup reads; the cast is confined to this fixture.
const branch = { id: 1, branchName: "Main" } as unknown as IBranch;

async function submitCashIn(amount: string): Promise<void> {
    render(<CashRegisterPopup branch={branch} open handleClose={jest.fn()} />);
    await waitFor(() => expect(mockGetBranchBalance).toHaveBeenCalled());
    fireEvent.click(screen.getByText("Add Cash"));
    fireEvent.change(await screen.findByLabelText("Amount"), { target: { value: amount } });
    fireEvent.click(screen.getByText("Confirm Deposit"));
}

beforeEach(() => {
    jest.clearAllMocks();
    mockUseBranchScope.mockReturnValue({
        branches: [branch],
        branch,
        setBranch: jest.fn(),
        canSwitch: false,
    });
    mockGetBranchBalance.mockResolvedValue({ branchBalance: 5 });
});

describe("CashRegisterPopup submit", () => {
    it("sends an idempotency key and shows the new balance on success", async () => {
        mockCashUpdate.mockResolvedValue(new Response(JSON.stringify({ branchBalance: 15 }), { status: 200 }));

        await submitCashIn("10");

        expect(await screen.findByText(/15\.00/)).toBeTruthy();
        expect(mockCashUpdate.mock.calls[0][0].idempotency_key).toBeTruthy();
    });

    it("shows the snackbar and clears the spinner when the request rejects", async () => {
        mockCashUpdate.mockRejectedValue(new PreResponseNetworkError(new TypeError("Failed to fetch")));

        await submitCashIn("10");

        expect(await screen.findByText(/no connection to the server/)).toBeTruthy();
        await waitFor(() => expect(screen.queryByRole("progressbar")).toBeNull());
    });

    it("shows the snackbar and clears the spinner when the response body is not JSON", async () => {
        mockCashUpdate.mockResolvedValue(new Response("<html>", { status: 200 }));

        await submitCashIn("10");

        expect(await screen.findByText(/Not saved:/)).toBeTruthy();
        await waitFor(() => expect(screen.queryByRole("progressbar")).toBeNull());
    });

    it("shows the server message on an HTTP error", async () => {
        mockCashUpdate.mockResolvedValue(new Response(JSON.stringify({ message: "Not enough cash" }), { status: 400 }));

        await submitCashIn("10");

        expect(await screen.findByText("Not enough cash")).toBeTruthy();
    });
});
