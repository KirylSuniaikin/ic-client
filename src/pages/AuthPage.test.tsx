import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { AuthPage } from "./AuthPage";
import type { AuthContextType } from "../domains/auth/types";

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/management.ts, which now
// exports `initiateAuth` alongside the rest of the API surface (see StaffSummaryContent.test.tsx
// for the same idiom). babel-jest hoists jest.mock() above the imports, so a factory here cannot
// close over anything, including `jest` itself -- the manual mock sidesteps that entirely.
jest.mock("../shared/api/management");

// No manual __mocks__ for AuthProvider exists (see AdminHomePage.test.tsx's identical pattern),
// so this uses Jest's automock and sets useAuth's return value explicitly below.
jest.mock("../domains/auth/context/AuthProvider");

import { initiateAuth } from "../shared/api/management";
import { useAuth } from "../domains/auth/context/AuthProvider";

const mockInitiateAuth = jest.mocked(initiateAuth);
const mockUseAuth = jest.mocked(useAuth);

function authValue(): AuthContextType {
    return {
        branchId: null,
        username: null,
        fullName: null,
        userId: null,
        role: null,
        logout: jest.fn(),
        login: jest.fn(),
        isAuthLoading: false,
    };
}

// AuthPage itself renders nothing that echoes where `navigate` landed -- this probe (rendered
// alongside it, inside the same MemoryRouter) reports the post-navigation location instead.
function LocationProbe(): JSX.Element {
    const location = useLocation();
    return <div data-testid="location-probe" data-pathname={location.pathname} data-search={location.search} />;
}

// AuthPage's <TextField> elements carry no explicit `id`, so MUI's generated <label> has no
// `htmlFor` pairing with the input -- getByLabelText can never match here. Username is the only
// role="textbox" in this form (Password is type="password", which is a different role), so
// getByRole is unambiguous; Password is reached via its DOM type instead, matching the
// `container.querySelectorAll("input")` idiom already used in PurchaseTableRow.test.tsx.
function fillAndSubmitLogin(container: HTMLElement): void {
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "casey" } });
    const passwordInput = container.querySelector('input[type="password"]') as HTMLInputElement;
    fireEvent.change(passwordInput, { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Login" }));
}

describe("AuthPage", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUseAuth.mockReturnValue(authValue());
        mockInitiateAuth.mockResolvedValue(new Response(JSON.stringify({ token: "jwt-token" }), { status: 200 }));
    });

    // review-feedback-D.md Issue 5: ProtectedRoute.tsx passes the FULL location (including
    // `.search`) into `state.from` when it redirects here -- a successful login must navigate
    // back with that search string intact, or a Telegram deep link's `?taskCardId=...` is
    // silently dropped on the way back to /admin.
    it("preserves the deep link's query string through the login redirect", async () => {
        const { container } = render(
            <MemoryRouter
                initialEntries={[
                    { pathname: "/auth", state: { from: { pathname: "/admin", search: "?taskCardId=42&assigneeId=7" } } },
                ]}
            >
                <AuthPage />
                <LocationProbe />
            </MemoryRouter>
        );

        fillAndSubmitLogin(container);

        await waitFor(() => {
            const probe = screen.getByTestId("location-probe");
            expect(probe.getAttribute("data-pathname")).toBe("/admin");
            expect(probe.getAttribute("data-search")).toBe("?taskCardId=42&assigneeId=7");
        });
    });

    it("falls back to /admin with no query string when there is no redirect target to preserve", async () => {
        const { container } = render(
            <MemoryRouter initialEntries={["/auth"]}>
                <AuthPage />
                <LocationProbe />
            </MemoryRouter>
        );

        fillAndSubmitLogin(container);

        await waitFor(() => {
            const probe = screen.getByTestId("location-probe");
            expect(probe.getAttribute("data-pathname")).toBe("/admin");
            expect(probe.getAttribute("data-search")).toBe("");
        });
    });
});
