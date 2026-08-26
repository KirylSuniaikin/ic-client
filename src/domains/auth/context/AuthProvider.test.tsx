import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import type { CurrentStaffTO } from "../../management/staff/types";
import { StaffRoles } from "../types";

const mockJwtDecode = jest.fn<Record<string, unknown>, [string]>();
jest.mock("jwt-decode", () => ({
    jwtDecode: (token: string) => mockJwtDecode(token),
}));

const mockGetCurrentStaff = jest.fn<Promise<CurrentStaffTO>, []>();
jest.mock("../../../shared/api/management", () => ({
    getCurrentStaff: () => mockGetCurrentStaff(),
}));

import { AuthProvider, useAuth } from "./AuthProvider";

// Reads the context out into the DOM so assertions do not depend on any consumer component.
function Probe(): React.JSX.Element {
    const { username, fullName, branchId, role } = useAuth();
    return (
        <div>
            <span data-testid="username">{username ?? ""}</span>
            <span data-testid="full-name">{fullName ?? ""}</span>
            <span data-testid="branch-id">{branchId ?? ""}</span>
            <span data-testid="role">{role ?? ""}</span>
        </div>
    );
}

function renderAuth(): void {
    render(
        <AuthProvider>
            <Probe />
        </AuthProvider>
    );
}

function currentStaff(overrides: Partial<CurrentStaffTO> = {}): CurrentStaffTO {
    return {
        id: 7,
        username: "casey.cook",
        fullName: "Casey Cook",
        role: StaffRoles.MANAGER,
        branchId: "branch-server",
        ...overrides,
    };
}

describe("AuthProvider", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.setItem("jwt_token", "a.b.c");
        mockJwtDecode.mockReturnValue({
            exp: Math.floor(Date.now() / 1000) + 3600,
            sub: "casey.cook",
            role: StaffRoles.MANAGER,
            userId: 7,
            branchId: "branch-from-token",
        });
        mockGetCurrentStaff.mockResolvedValue(currentStaff());
    });

    afterEach(() => {
        localStorage.clear();
    });

    // The token carries `sub` (the login) and no human name at all, so every surface that shows
    // "who is signed in" was stuck with the login until GET /api/staff/me answered.
    it("fills fullName from the server, having started with none", async () => {
        renderAuth();

        expect(screen.getByTestId("full-name").textContent).toBe("");

        await waitFor(() => expect(screen.getByTestId("full-name").textContent).toBe("Casey Cook"));
        expect(screen.getByTestId("username").textContent).toBe("casey.cook");
    });

    // The branchId claim is frozen at login, and staff can now be moved between branches.
    it("replaces the token's branch claim with the server's", async () => {
        renderAuth();

        expect(screen.getByTestId("branch-id").textContent).toBe("branch-from-token");

        await waitFor(() => expect(screen.getByTestId("branch-id").textContent).toBe("branch-server"));
    });

    it("keeps the token's claims and stays signed in when /staff/me fails", async () => {
        mockGetCurrentStaff.mockRejectedValue(new Error("Response: 500"));

        renderAuth();

        await waitFor(() => expect(mockGetCurrentStaff).toHaveBeenCalled());
        expect(screen.getByTestId("branch-id").textContent).toBe("branch-from-token");
        expect(screen.getByTestId("username").textContent).toBe("casey.cook");
        expect(screen.getByTestId("role").textContent).toBe(StaffRoles.MANAGER);
        // No name is strictly better than a wrong one; consumers fall back to the username.
        expect(screen.getByTestId("full-name").textContent).toBe("");
    });

    it("leaves fullName empty when the staff member has none recorded", async () => {
        mockGetCurrentStaff.mockResolvedValue(currentStaff({ fullName: null }));

        renderAuth();

        await waitFor(() => expect(mockGetCurrentStaff).toHaveBeenCalled());
        expect(screen.getByTestId("full-name").textContent).toBe("");
    });

    it("does not call /staff/me when there is no token", async () => {
        localStorage.removeItem("jwt_token");

        renderAuth();

        await waitFor(() => expect(screen.getByTestId("username").textContent).toBe(""));
        expect(mockGetCurrentStaff).not.toHaveBeenCalled();
    });

    it("clears the stored token when it has already expired", async () => {
        mockJwtDecode.mockReturnValue({
            exp: Math.floor(Date.now() / 1000) - 10,
            sub: "casey.cook",
            role: StaffRoles.MANAGER,
            userId: 7,
            branchId: "branch-from-token",
        });

        renderAuth();

        await waitFor(() => expect(localStorage.getItem("jwt_token")).toBeNull());
        expect(screen.getByTestId("username").textContent).toBe("");
    });
});
