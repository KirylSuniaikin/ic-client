import { jest, describe, it, expect, beforeEach, beforeAll } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { StaffRoles } from "../../../auth/types";
import type { StaffAdminTO } from "../types";
import ResetPasswordDrawer from "./ResetPasswordDrawer";

// jsdom lacks crypto.getRandomValues, which generatePassword needs. Mirrors the stub in
// HireStaffDrawer.test.tsx / generatePassword.test.ts.
beforeAll(function () {
    if (typeof globalThis.crypto === "undefined" || typeof globalThis.crypto.getRandomValues !== "function") {
        const cryptoStub = {
            getRandomValues: (arr: Uint32Array): Uint32Array => {
                for (let i = 0; i < arr.length; i++) {
                    arr[i] = Math.floor(Math.random() * 0xffffffff);
                }
                return arr;
            },
        };
        Object.defineProperty(globalThis, "crypto", { value: cryptoStub, configurable: true });
    }
});

jest.mock("../utils/copyToClipboard");

function makeStaff(overrides: Partial<StaffAdminTO> = {}): StaffAdminTO {
    return {
        id: 7,
        username: "casey.cook",
        fullName: "Casey Cook",
        role: StaffRoles.COOK,
        branchId: "branch-1",
        pricePerHour: null,
        enabled: true,
        cprNumber: null,
        basicSalary: null,
        housingAllowance: null,
        transportAllowance: null,
        ...overrides,
    };
}

function passwordValue(): string {
    return (screen.getByTestId("reset-password-field").querySelector("input") as HTMLInputElement).value;
}

describe("ResetPasswordDrawer", () => {
    beforeEach(() => jest.clearAllMocks());

    it("arrives with a generated password already filled in", () => {
        render(
            <ResetPasswordDrawer
                open
                target={makeStaff()}
                onClose={jest.fn<void, []>()}
                resetPassword={jest.fn<Promise<void>, [number, string]>()}
            />,
        );

        expect(passwordValue().length).toBeGreaterThan(0);
    });

    it("re-rolls the password on Generate", () => {
        render(
            <ResetPasswordDrawer
                open
                target={makeStaff()}
                onClose={jest.fn<void, []>()}
                resetPassword={jest.fn<Promise<void>, [number, string]>()}
            />,
        );

        const first = passwordValue();
        fireEvent.click(screen.getByTestId("reset-password-generate"));

        expect(passwordValue()).not.toBe(first);
    });

    it("submits the shown password for the target, then reveals it once", async () => {
        const resetPassword = jest.fn<Promise<void>, [number, string]>().mockResolvedValue(undefined);
        render(
            <ResetPasswordDrawer open target={makeStaff()} onClose={jest.fn<void, []>()} resetPassword={resetPassword} />,
        );

        const shown = passwordValue();
        fireEvent.click(screen.getByTestId("reset-password-submit"));

        await waitFor(() => expect(resetPassword).toHaveBeenCalledWith(7, shown));

        const panel = await screen.findByTestId("reset-password-credentials");
        expect(panel).toBeTruthy();
        expect(screen.getByText("This password will not be shown again.")).toBeTruthy();
    });

    // Says the true thing: a reset does not end the person's current session, because there is
    // no passwordChangedAt and no revocation list. Deactivation is what cuts access.
    it("warns that resetting does not sign the person out", () => {
        render(
            <ResetPasswordDrawer
                open
                target={makeStaff()}
                onClose={jest.fn<void, []>()}
                resetPassword={jest.fn<Promise<void>, [number, string]>()}
            />,
        );

        expect(screen.getByText(/does not sign this person out/)).toBeTruthy();
    });

    it("shows the failure inline and keeps the password when the reset is rejected", async () => {
        const resetPassword = jest.fn<Promise<void>, [number, string]>()
            .mockRejectedValue(new Error("Response: 403"));
        render(
            <ResetPasswordDrawer open target={makeStaff()} onClose={jest.fn<void, []>()} resetPassword={resetPassword} />,
        );

        const shown = passwordValue();
        fireEvent.click(screen.getByTestId("reset-password-submit"));

        expect(await screen.findByTestId("reset-password-error")).toBeTruthy();
        expect(passwordValue()).toBe(shown);
        expect(screen.queryByTestId("reset-password-credentials")).toBeNull();
    });

    // The whole point of a one-time reveal: nothing may survive the drawer closing.
    it("keeps no plaintext once closed", () => {
        const { rerender } = render(
            <ResetPasswordDrawer
                open
                target={makeStaff()}
                onClose={jest.fn<void, []>()}
                resetPassword={jest.fn<Promise<void>, [number, string]>()}
            />,
        );

        const first = passwordValue();

        rerender(
            <ResetPasswordDrawer
                open={false}
                target={makeStaff()}
                onClose={jest.fn<void, []>()}
                resetPassword={jest.fn<Promise<void>, [number, string]>()}
            />,
        );
        rerender(
            <ResetPasswordDrawer
                open
                target={makeStaff()}
                onClose={jest.fn<void, []>()}
                resetPassword={jest.fn<Promise<void>, [number, string]>()}
            />,
        );

        expect(passwordValue()).not.toBe(first);
        expect(screen.queryByTestId("reset-password-credentials")).toBeNull();
    });
});
