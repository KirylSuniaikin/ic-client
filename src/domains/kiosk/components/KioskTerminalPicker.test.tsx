import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KioskTerminalPicker } from "./KioskTerminalPicker";
import { fetchPairingOptions, PairingUnavailableError } from "../../../shared/api/kiosk";
import type { PairingKiosk } from "../../../shared/api/kiosk";
import { KIOSK_DEVICE_NAME_KEY } from "../services/kioskIdentity";

jest.mock("../../../shared/api/kiosk");

const mockFetchPairing = jest.mocked(fetchPairingOptions);

const JUFFAIR: PairingKiosk = {
    deviceName: "kiosk-juffair-1",
    terminalId: "200088181",
    branchId: "branch-1",
    branchName: "Juffair",
};
const SEEF: PairingKiosk = {
    deviceName: "kiosk-seef-1",
    terminalId: "200088182",
    branchId: "branch-2",
    branchName: "Seef",
};

describe("KioskTerminalPicker", () => {
    beforeEach(() => {
        localStorage.clear();
        mockFetchPairing.mockReset();
        mockFetchPairing.mockResolvedValue([JUFFAIR, SEEF]);
    });

    it("shows only the kiosks belonging to the selected branch", async () => {
        render(<KioskTerminalPicker selectedBranchId="branch-1" onSelect={jest.fn()} />);

        // The backend's pairing list is not branch-filtered, so this filtering has to happen here.
        await waitFor(() => expect(screen.getByText("kiosk-juffair-1")).toBeTruthy());
        expect(screen.queryByText("kiosk-seef-1")).toBeNull();
    });

    it("persists the device name and reports the selection", async () => {
        const onSelect = jest.fn();
        render(<KioskTerminalPicker selectedBranchId="branch-1" onSelect={onSelect} />);
        await waitFor(() => expect(screen.getByText("kiosk-juffair-1")).toBeTruthy());

        await userEvent.click(screen.getByText("kiosk-juffair-1"));

        expect(localStorage.getItem(KIOSK_DEVICE_NAME_KEY)).toBe("kiosk-juffair-1");
        expect(onSelect).toHaveBeenCalledWith(JUFFAIR);
    });

    it("explains an unavailable pairing endpoint rather than showing a blank list", async () => {
        mockFetchPairing.mockRejectedValue(new PairingUnavailableError());
        render(<KioskTerminalPicker selectedBranchId="branch-1" onSelect={jest.fn()} />);

        // A stale backend deploy is the most likely cause and staff can act on that.
        await waitFor(() => expect(screen.getByText(/Kiosk pairing is unavailable/)).toBeTruthy());
        expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    });

    it("retries the fetch when Try again is pressed", async () => {
        mockFetchPairing.mockRejectedValueOnce(new Error("offline"));
        render(<KioskTerminalPicker selectedBranchId="branch-1" onSelect={jest.fn()} />);
        await waitFor(() => expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy());

        mockFetchPairing.mockResolvedValue([JUFFAIR]);
        await userEvent.click(screen.getByRole("button", { name: "Try again" }));

        await waitFor(() => expect(screen.getByText("kiosk-juffair-1")).toBeTruthy());
    });

    it("says so when the branch has no kiosks registered yet", async () => {
        mockFetchPairing.mockResolvedValue([SEEF]);
        render(<KioskTerminalPicker selectedBranchId="branch-1" onSelect={jest.fn()} />);

        await waitFor(() => expect(screen.getByText(/No kiosks are registered/)).toBeTruthy());
    });
});
