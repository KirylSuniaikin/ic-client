import { jest, describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ShadowPilotSwitch from "./ShadowPilotSwitch";
import type { DisciplineSettingsTO } from "../../discipline/types";

const OFF: DisciplineSettingsTO = { shadowPilot: false, updatedAt: null, updatedByName: null };
const ON: DisciplineSettingsTO = { shadowPilot: true, updatedAt: "2026-10-08T10:00:00", updatedByName: "Ann" };

type OnChange = (v: boolean) => Promise<void>;

const toggle = (): HTMLInputElement => screen.getByRole("switch", { name: "Shadow pilot" }) as HTMLInputElement;

describe("ShadowPilotSwitch", () => {
    it("shows the server value, helper text and no audit line when never changed", () => {
        render(<ShadowPilotSwitch settings={OFF} onChange={jest.fn<Promise<void>, [boolean]>()} />);

        expect(toggle().checked).toBe(false);
        expect(screen.getByText(/no penalty hours are applied and no documents are generated/)).toBeTruthy();
        expect(screen.queryByText(/Last changed by/)).toBeNull();
    });

    it("shows who changed it when updatedAt is set", () => {
        render(<ShadowPilotSwitch settings={ON} onChange={jest.fn<Promise<void>, [boolean]>()} />);

        expect(toggle().checked).toBe(true);
        expect(screen.getByText("Last changed by Ann, 8 Oct 2026, 10:00")).toBeTruthy();
    });

    it("hides the audit line when the changer's name is missing", () => {
        render(<ShadowPilotSwitch settings={{ ...ON, updatedByName: null }} onChange={jest.fn<Promise<void>, [boolean]>()} />);

        expect(screen.queryByText(/Last changed by/)).toBeNull();
    });

    it("shows the 'Pilot mode is ON' indicator when the pilot is on", () => {
        render(<ShadowPilotSwitch settings={ON} onChange={jest.fn<Promise<void>, [boolean]>()} />);

        expect(screen.getByText("Pilot mode is ON")).toBeTruthy();
    });

    it("hides the indicator when the pilot is off", () => {
        render(<ShadowPilotSwitch settings={OFF} onChange={jest.fn<Promise<void>, [boolean]>()} />);

        expect(screen.queryByText("Pilot mode is ON")).toBeNull();
    });

    it("hides the indicator while settings are not loaded", () => {
        render(<ShadowPilotSwitch settings={null} onChange={jest.fn<Promise<void>, [boolean]>()} />);

        expect(screen.queryByText("Pilot mode is ON")).toBeNull();
    });

    it("turns the pilot off with onChange(false) when it is on", async () => {
        const onChange = jest.fn<Promise<void>, [boolean]>().mockResolvedValue(undefined);
        render(<ShadowPilotSwitch settings={ON} onChange={onChange} />);

        await userEvent.click(toggle());

        expect(onChange).toHaveBeenCalledWith(false);
        await waitFor(() => expect(toggle().disabled).toBe(false));
    });

    it("is disabled while settings are not loaded", () => {
        render(<ShadowPilotSwitch settings={null} onChange={jest.fn<Promise<void>, [boolean]>()} />);

        expect(toggle().disabled).toBe(true);
    });

    it("calls onChange with the inverted value", async () => {
        const onChange = jest.fn<Promise<void>, [boolean]>().mockResolvedValue(undefined);
        render(<ShadowPilotSwitch settings={OFF} onChange={onChange} />);

        await userEvent.click(toggle());

        expect(onChange).toHaveBeenCalledWith(true);
        await waitFor(() => expect(toggle().disabled).toBe(false));
    });

    it("is disabled while the request is in flight and stays on the server value", async () => {
        let resolve: () => void = () => undefined;
        const onChange = jest.fn<Promise<void>, [boolean]>().mockImplementation(
            () => new Promise<void>((r) => {
                resolve = r;
            }),
        );
        render(<ShadowPilotSwitch settings={OFF} onChange={onChange} />);

        await userEvent.click(toggle());

        expect(toggle().disabled).toBe(true);
        expect(toggle().checked).toBe(false);
        resolve();
        await waitFor(() => expect(toggle().disabled).toBe(false));
    });

    it("shows the error and keeps the old value on failure", async () => {
        const onChange = jest.fn<Promise<void>, [boolean]>().mockRejectedValue(new Error("Not allowed"));
        render(<ShadowPilotSwitch settings={OFF} onChange={onChange} />);

        await userEvent.click(toggle());

        expect((await screen.findByRole("alert")).textContent).toBe("Not allowed");
        expect(toggle().checked).toBe(false);
        expect(toggle().disabled).toBe(false);
    });
});
