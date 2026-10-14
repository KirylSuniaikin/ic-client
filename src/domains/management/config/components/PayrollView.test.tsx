import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PayrollView from "./PayrollView";
import { fetchPayrollSettings, updatePayrollSettings } from "../../../../shared/api/management";
import type { PayrollSettingsTO } from "../types";

jest.mock("../../../../shared/api/management");

const mockFetch = jest.mocked(fetchPayrollSettings);
const mockUpdate = jest.mocked(updatePayrollSettings);

const OFF: PayrollSettingsTO = { capPaidOvertime: false, updatedAt: null, updatedByName: null };
const ON: PayrollSettingsTO = { capPaidOvertime: true, updatedAt: "2026-10-14T10:00:00", updatedByName: "Ann" };

const toggle = (): HTMLInputElement =>
    screen.getByRole("switch", { name: "Limit paid overtime to 1 hour per shift" }) as HTMLInputElement;

describe("PayrollView", () => {
    beforeEach(() => {
        jest.resetAllMocks();
        mockFetch.mockResolvedValue(OFF);
    });

    it("shows the cap as off by default and no audit line", async () => {
        render(<PayrollView />);

        await waitFor(() => expect(toggle().disabled).toBe(false));
        expect(toggle().checked).toBe(false);
        expect(screen.queryByText(/Last changed by/)).toBeNull();
    });

    it("is disabled until the settings have loaded", () => {
        mockFetch.mockReturnValue(new Promise(() => undefined));
        render(<PayrollView />);

        expect(toggle().disabled).toBe(true);
    });

    it("turns the cap on with capPaidOvertime true and shows who changed it", async () => {
        mockUpdate.mockResolvedValue(ON);
        render(<PayrollView />);
        await waitFor(() => expect(toggle().disabled).toBe(false));

        await userEvent.click(toggle());

        expect(mockUpdate).toHaveBeenCalledWith({ capPaidOvertime: true });
        await waitFor(() => expect(toggle().checked).toBe(true));
        expect(screen.getByText("Last changed by Ann, 14 Oct 2026, 10:00")).toBeTruthy();
    });

    it("turns the cap back off when it is on", async () => {
        mockFetch.mockResolvedValue(ON);
        mockUpdate.mockResolvedValue(OFF);
        render(<PayrollView />);
        await waitFor(() => expect(toggle().checked).toBe(true));

        await userEvent.click(toggle());

        expect(mockUpdate).toHaveBeenCalledWith({ capPaidOvertime: false });
        await waitFor(() => expect(toggle().checked).toBe(false));
    });

    it("shows the server error and keeps the previous value when saving fails", async () => {
        mockUpdate.mockRejectedValue(new Error("the server refused it (error 403)"));
        render(<PayrollView />);
        await waitFor(() => expect(toggle().disabled).toBe(false));

        await userEvent.click(toggle());

        expect((await screen.findByRole("alert")).textContent).toBe("the server refused it (error 403)");
        expect(toggle().checked).toBe(false);
    });

    it("shows the load error when the settings cannot be read", async () => {
        mockFetch.mockRejectedValue(new Error("boom"));
        render(<PayrollView />);

        expect((await screen.findByRole("alert")).textContent).toBe("boom");
    });
});
