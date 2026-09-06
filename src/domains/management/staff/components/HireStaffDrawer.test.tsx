import { jest, describe, it, expect, beforeEach, beforeAll } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { StaffRoles } from "../../../auth/types";
import type { HireStaffRequest, HiredStaffTO } from "../types";
import { copyToClipboard } from "../utils/copyToClipboard";

// jsdom's test environment lacks crypto.getRandomValues (used by generatePassword via the
// Generate button). Mirrors the stub in generatePassword.test.ts/PurchaseTablePopup.test.tsx.
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

type AuthValue = { role: StaffRoles | null; branchId: string | null };
const mockUseAuth = jest.fn<AuthValue, []>();
jest.mock("../../../auth/context/AuthProvider", () => ({
    useAuth: () => mockUseAuth(),
}));

type Branch = { id: string; externalId: string; branchNo: number; branchName: string; locale: string };
// The drawer fetches its own branch list now: the ambient ManagementBranchScope is seeded from
// the caller's own scope, so it is empty or one-element exactly when a city-level hirer needs
// every branch.
const mockFetchAllBranches = jest.fn<Promise<Branch[]>, []>();
jest.mock("../../../../shared/api/management", () => ({
    fetchAllBranches: () => mockFetchAllBranches(),
}));

// No manual mock exists for this tiny util -- factoryless jest.mock() automocks it, and
// beforeEach below decides what it resolves to.
jest.mock("../utils/copyToClipboard");

import HireStaffDrawer from "./HireStaffDrawer";

const mockCopyToClipboard = jest.mocked(copyToClipboard);

const BRANCH_1: Branch = { id: "branch-1", externalId: "ext-1", branchNo: 1, branchName: "Adliya", locale: "adl" };
const BRANCH_2: Branch = { id: "branch-2", externalId: "ext-2", branchNo: 2, branchName: "Seef", locale: "seef" };

function hired(overrides: Partial<HiredStaffTO> = {}): HiredStaffTO {
    return {
        id: 5,
        username: "new.cook",
        fullName: "New Cook",
        role: StaffRoles.COOK,
        pricePerHour: 3,
        branchId: "branch-1",
        cprNumber: null,
        ...overrides,
    };
}

function fillRequiredFields(role: string): void {
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "New Cook" } });
    fireEvent.change(screen.getByLabelText("Login"), { target: { value: "new.cook" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "s3cretPW" } });
    fireEvent.mouseDown(within(screen.getByTestId("hire-staff-role-select")).getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: role }));
    fireEvent.change(screen.getByLabelText("Price/hour"), { target: { value: "3" } });
}

describe("HireStaffDrawer", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUseAuth.mockReturnValue({ role: StaffRoles.MANAGER, branchId: "branch-1" });
        mockFetchAllBranches.mockResolvedValue([]);
        mockCopyToClipboard.mockResolvedValue(undefined);
    });

    it("filters role options per the hierarchy for a MANAGER caller (no MANAGER/SUPER_MANAGER/OWNER)", () => {
        render(<HireStaffDrawer open onClose={jest.fn()} create={jest.fn<Promise<HiredStaffTO>, [HireStaffRequest]>()} />);

        fireEvent.mouseDown(within(screen.getByTestId("hire-staff-role-select")).getByRole("combobox"));

        expect(screen.getByRole("option", { name: "COOK" })).toBeTruthy();
        expect(screen.getByRole("option", { name: "SUPERVISOR" })).toBeTruthy();
        expect(screen.getByRole("option", { name: "REVIEWER" })).toBeTruthy();
        expect(screen.queryByRole("option", { name: "MANAGER" })).toBeNull();
        expect(screen.queryByRole("option", { name: "SUPER_MANAGER" })).toBeNull();
        expect(screen.queryByRole("option", { name: "OWNER" })).toBeNull();
    });

    it("allows an OWNER caller to select every role including OWNER", () => {
        mockUseAuth.mockReturnValue({ role: StaffRoles.OWNER, branchId: "branch-1" });

        render(<HireStaffDrawer open onClose={jest.fn()} create={jest.fn<Promise<HiredStaffTO>, [HireStaffRequest]>()} />);

        fireEvent.mouseDown(within(screen.getByTestId("hire-staff-role-select")).getByRole("combobox"));

        expect(screen.getByRole("option", { name: "OWNER" })).toBeTruthy();
        expect(screen.getByRole("option", { name: "SUPER_MANAGER" })).toBeTruthy();
        expect(screen.getByRole("option", { name: "MANAGER" })).toBeTruthy();
    });

    it("does not render a branch selector for a non-city-access caller", () => {
        render(<HireStaffDrawer open onClose={jest.fn()} create={jest.fn<Promise<HiredStaffTO>, [HireStaffRequest]>()} />);

        expect(screen.queryByText("Branch")).toBeNull();
    });

    it("renders a branch selector for a city-access caller", () => {
        mockUseAuth.mockReturnValue({ role: StaffRoles.OWNER, branchId: "branch-1" });
        mockFetchAllBranches.mockResolvedValue([BRANCH_1, BRANCH_2]);

        render(<HireStaffDrawer open onClose={jest.fn()} create={jest.fn<Promise<HiredStaffTO>, [HireStaffRequest]>()} />);

        expect(screen.getAllByText("Branch").length).toBeGreaterThan(0);
    });

    it("generates a non-empty password via the Generate button", () => {
        render(<HireStaffDrawer open onClose={jest.fn()} create={jest.fn<Promise<HiredStaffTO>, [HireStaffRequest]>()} />);

        fireEvent.click(screen.getByTestId("hire-staff-generate-password"));

        const passwordInput = screen.getByLabelText("Password") as HTMLInputElement;
        expect(passwordInput.value.length).toBeGreaterThan(0);
    });

    it("submits the caller's own branchId for a non-city-access caller and shows the credentials view once", async () => {
        const createMock = jest.fn<Promise<HiredStaffTO>, [HireStaffRequest]>().mockResolvedValue(hired());

        render(<HireStaffDrawer open onClose={jest.fn()} create={createMock} />);

        fillRequiredFields("COOK");
        fireEvent.click(screen.getByText("Add"));

        await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
        expect(createMock).toHaveBeenCalledWith({
            username: "new.cook",
            password: "s3cretPW",
            fullName: "New Cook",
            role: StaffRoles.COOK,
            pricePerHour: 3,
            cprNumber: null,
            branchId: "branch-1",
        });

        await waitFor(() => expect(screen.getByTestId("hire-staff-credentials")).toBeTruthy());
        expect(screen.getByText(/will not be shown again/i)).toBeTruthy();
    });

    it("copy button calls copyToClipboard with the credentials", async () => {
        const createMock = jest.fn<Promise<HiredStaffTO>, [HireStaffRequest]>().mockResolvedValue(hired());

        render(<HireStaffDrawer open onClose={jest.fn()} create={createMock} />);

        fillRequiredFields("COOK");
        fireEvent.click(screen.getByText("Add"));

        await waitFor(() => expect(screen.getByTestId("hire-staff-credentials")).toBeTruthy());

        fireEvent.click(screen.getByTestId("hire-staff-copy-button"));

        await waitFor(() => expect(mockCopyToClipboard).toHaveBeenCalledWith("new.cook / s3cretPW"));
    });

    it("surfaces a 409 error without clearing entered fields", async () => {
        const createMock = jest.fn<Promise<HiredStaffTO>, [HireStaffRequest]>().mockRejectedValue(new Error("HTTP 409"));

        render(<HireStaffDrawer open onClose={jest.fn()} create={createMock} />);

        fillRequiredFields("COOK");
        fireEvent.click(screen.getByText("Add"));

        await waitFor(() => expect(screen.getByTestId("hire-staff-error")).toBeTruthy());
        expect((screen.getByLabelText("Login") as HTMLInputElement).value).toBe("new.cook");
        expect((screen.getByLabelText("Full name") as HTMLInputElement).value).toBe("New Cook");
    });

    it("disables Hire until the required fields are filled", () => {
        render(<HireStaffDrawer open onClose={jest.fn()} create={jest.fn<Promise<HiredStaffTO>, [HireStaffRequest]>()} />);

        const hireButton = screen.getByText("Add").closest("button") as HTMLButtonElement;
        expect(hireButton.disabled).toBe(true);
    });

    it("surfaces a copy error instead of claiming success when the clipboard write fails", async () => {
        const createMock = jest.fn<Promise<HiredStaffTO>, [HireStaffRequest]>().mockResolvedValue(hired());
        mockCopyToClipboard.mockRejectedValue(new Error("copy denied"));

        render(<HireStaffDrawer open onClose={jest.fn()} create={createMock} />);

        fillRequiredFields("COOK");
        fireEvent.click(screen.getByText("Add"));

        await waitFor(() => expect(screen.getByTestId("hire-staff-credentials")).toBeTruthy());

        fireEvent.click(screen.getByTestId("hire-staff-copy-button"));

        await waitFor(() => expect(screen.getByTestId("hire-staff-copy-error")).toBeTruthy());
        expect(screen.queryByText("Copied!")).toBeNull();
    });

    // Awaited, not synchronous: the warning must appear only once the fetch has actually answered
    // with nothing. Rendering it before then would flash "no branches" on every single open.
    it("shows a no-branches warning for a city-access caller once the fetch returns none", async () => {
        mockUseAuth.mockReturnValue({ role: StaffRoles.OWNER, branchId: "branch-1" });
        mockFetchAllBranches.mockResolvedValue([]);

        render(<HireStaffDrawer open onClose={jest.fn()} create={jest.fn<Promise<HiredStaffTO>, [HireStaffRequest]>()} />);

        expect(screen.queryByTestId("hire-staff-no-branches")).toBeNull();
        await waitFor(() => expect(screen.getByTestId("hire-staff-no-branches")).toBeTruthy());
    });

    it("surfaces a failed branch fetch instead of leaving an empty picker", async () => {
        mockUseAuth.mockReturnValue({ role: StaffRoles.OWNER, branchId: "branch-1" });
        mockFetchAllBranches.mockRejectedValue(new Error("HTTP 500"));

        render(<HireStaffDrawer open onClose={jest.fn()} create={jest.fn<Promise<HiredStaffTO>, [HireStaffRequest]>()} />);

        await waitFor(() => expect(screen.getByTestId("hire-staff-error")).toBeTruthy());
        expect(screen.getByTestId("hire-staff-error").textContent).toContain("Failed to load branches");
    });

    it("pre-selects the branch the roster was scoped to", async () => {
        mockUseAuth.mockReturnValue({ role: StaffRoles.OWNER, branchId: "branch-1" });
        mockFetchAllBranches.mockResolvedValue([BRANCH_1, BRANCH_2]);

        render(
            <HireStaffDrawer
                open
                onClose={jest.fn()}
                create={jest.fn<Promise<HiredStaffTO>, [HireStaffRequest]>()}
                defaultBranchId={BRANCH_2.id}
            />
        );

        await waitFor(() => expect(screen.getByTestId("hire-staff-branch-select").textContent).toContain("Seef"));
    });

    // Captured at hire so it does not have to be filled in from the Account Manager afterwards.
    it("sends the CPR number entered on the hire form", async () => {
        const createMock = jest.fn<Promise<HiredStaffTO>, [HireStaffRequest]>().mockResolvedValue(hired());

        render(<HireStaffDrawer open onClose={jest.fn()} create={createMock} />);

        fillRequiredFields("COOK");
        fireEvent.change(screen.getByLabelText("CPR No. (optional)"), { target: { value: "850012345" } });
        fireEvent.click(screen.getByText("Add"));

        await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
        expect(createMock.mock.calls[0][0].cprNumber).toBe("850012345");
    });

    // The column is nullable and the field is optional -- a blank must not persist as "".
    it("sends null when the CPR is left blank", async () => {
        const createMock = jest.fn<Promise<HiredStaffTO>, [HireStaffRequest]>().mockResolvedValue(hired());

        render(<HireStaffDrawer open onClose={jest.fn()} create={createMock} />);

        fillRequiredFields("COOK");
        fireEvent.click(screen.getByText("Add"));

        await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
        expect(createMock.mock.calls[0][0].cprNumber).toBeNull();
    });

    // OWNER-only, mirroring EditPayrollDrawer's payroll gate elsewhere in this domain.
    it("renders the Basic Salary field for an OWNER caller", () => {
        mockUseAuth.mockReturnValue({ role: StaffRoles.OWNER, branchId: "branch-1" });

        render(<HireStaffDrawer open onClose={jest.fn()} create={jest.fn<Promise<HiredStaffTO>, [HireStaffRequest]>()} />);

        expect(screen.getByTestId("hire-staff-basic-salary")).toBeTruthy();
    });

    it("does not render the Basic Salary field for a non-owner caller", () => {
        mockUseAuth.mockReturnValue({ role: StaffRoles.SUPER_MANAGER, branchId: "branch-1" });

        render(<HireStaffDrawer open onClose={jest.fn()} create={jest.fn<Promise<HiredStaffTO>, [HireStaffRequest]>()} />);

        expect(screen.queryByTestId("hire-staff-basic-salary")).toBeNull();
    });

    it("auto-fills Price/hour from Basic Salary and Hours when Price/hour was empty", () => {
        mockUseAuth.mockReturnValue({ role: StaffRoles.OWNER, branchId: "branch-1" });

        render(<HireStaffDrawer open onClose={jest.fn()} create={jest.fn<Promise<HiredStaffTO>, [HireStaffRequest]>()} />);

        fireEvent.change(screen.getByLabelText("Basic Salary"), {
            target: { value: "832" },
        });

        const priceInput = screen.getByLabelText("Price/hour") as HTMLInputElement;
        expect(priceInput.value).toBe((832 / 208).toFixed(3));
    });

    it("does not overwrite a manually-typed Price/hour once Basic Salary and Hours are entered", () => {
        mockUseAuth.mockReturnValue({ role: StaffRoles.OWNER, branchId: "branch-1" });

        render(<HireStaffDrawer open onClose={jest.fn()} create={jest.fn<Promise<HiredStaffTO>, [HireStaffRequest]>()} />);

        fireEvent.change(screen.getByLabelText("Price/hour"), { target: { value: "5" } });
        fireEvent.change(screen.getByLabelText("Basic Salary"), {
            target: { value: "832" },
        });

        expect((screen.getByLabelText("Price/hour") as HTMLInputElement).value).toBe("5");
    });

    it("includes basicSalary in the create(...) call when filled in as OWNER", async () => {
        mockUseAuth.mockReturnValue({ role: StaffRoles.OWNER, branchId: "branch-1" });
        mockFetchAllBranches.mockResolvedValue([BRANCH_1, BRANCH_2]);
        const createMock = jest.fn<Promise<HiredStaffTO>, [HireStaffRequest]>().mockResolvedValue(hired());

        render(<HireStaffDrawer open onClose={jest.fn()} create={createMock} />);

        // OWNER has city access, so a branch must finish auto-selecting before Add is enabled.
        await waitFor(() => expect(screen.getByTestId("hire-staff-branch-select").textContent).toContain("Adliya"));

        fillRequiredFields("COOK");
        fireEvent.change(screen.getByLabelText("Basic Salary"), {
            target: { value: "600" },
        });
        fireEvent.click(screen.getByText("Add"));

        await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
        expect(createMock.mock.calls[0][0].basicSalary).toBe(600);
    });

    it("omits basicSalary from the create(...) call when left empty", async () => {
        mockUseAuth.mockReturnValue({ role: StaffRoles.OWNER, branchId: "branch-1" });
        mockFetchAllBranches.mockResolvedValue([BRANCH_1, BRANCH_2]);
        const createMock = jest.fn<Promise<HiredStaffTO>, [HireStaffRequest]>().mockResolvedValue(hired());

        render(<HireStaffDrawer open onClose={jest.fn()} create={createMock} />);

        await waitFor(() => expect(screen.getByTestId("hire-staff-branch-select").textContent).toContain("Adliya"));

        fillRequiredFields("COOK");
        fireEvent.click(screen.getByText("Add"));

        await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
        expect(createMock.mock.calls[0][0].basicSalary).toBeUndefined();
    });

    // The calculator is meant to work out-of-the-box for a standard month without the admin
    // having to touch the Hours field at all -- so 208 must be there on open, not just as a
    // fallback once the field is cleared.
    it("defaults the Hours field to 208 when the drawer opens", () => {
        mockUseAuth.mockReturnValue({ role: StaffRoles.OWNER, branchId: "branch-1" });

        render(<HireStaffDrawer open onClose={jest.fn()} create={jest.fn<Promise<HiredStaffTO>, [HireStaffRequest]>()} />);

        expect((screen.getByLabelText("Hours") as HTMLInputElement).value).toBe("208");
    });

    // Uses a non-round quotient (2.667, not an exact whole-BD number) so a formula bug that
    // happened to line up on whole-number inputs elsewhere in this file can't hide here.
    it("auto-fills Price/hour with a rounded, non-integer quotient from a typed Basic Salary and Hours", () => {
        mockUseAuth.mockReturnValue({ role: StaffRoles.OWNER, branchId: "branch-1" });

        render(<HireStaffDrawer open onClose={jest.fn()} create={jest.fn<Promise<HiredStaffTO>, [HireStaffRequest]>()} />);

        fireEvent.change(screen.getByLabelText("Hours"), { target: { value: "150" } });
        fireEvent.change(screen.getByLabelText("Basic Salary"), { target: { value: "400" } });

        const priceInput = screen.getByLabelText("Price/hour") as HTMLInputElement;
        expect(priceInput.value).toBe((400 / 150).toFixed(3));
        expect(priceInput.value).toBe("2.667");
    });
});
