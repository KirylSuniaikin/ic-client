import { jest, describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AppRouter } from "./router";

jest.mock("../pages/HomePage", () => ({
    __esModule: true,
    default: function StubHomePage() {
        return require("react").createElement("div", null, "stub-home-page");
    },
}));

jest.mock("../pages/AdminHomePage", () => ({
    __esModule: true,
    default: function StubAdminHomePage() {
        return require("react").createElement("div", null, "stub-admin-page");
    },
}));

jest.mock("../pages/OrderStatusPage", () => ({
    OrderStatusPage: function StubOrderStatusPage() {
        return require("react").createElement("div", null, "stub-order-status");
    },
}));

jest.mock("../pages/AuthPage", () => ({
    AuthPage: function StubAuthPage() {
        return require("react").createElement("div", null, "stub-auth-page");
    },
}));

jest.mock("../domains/auth/components/ProtectedRoute", () => ({
    ProtectedRoute: function StubProtectedRoute({ children }) {
        return require("react").createElement(require("react").Fragment, null, children);
    },
}));

function renderAt(path: string) {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <AppRouter />
        </MemoryRouter>
    );
}

function LocationProbe(): JSX.Element {
    const location = useLocation();
    return <div data-testid="location-probe" data-pathname={location.pathname} />;
}

// The privacy page is rendered for real rather than stubbed: what these routes promise is which
// policy tab opens, and its SeoHead needs a HelmetProvider above it.
function renderPrivacyAt(path: string) {
    return render(
        <HelmetProvider>
            <MemoryRouter initialEntries={[path]}>
                <AppRouter />
                <LocationProbe />
            </MemoryRouter>
        </HelmetProvider>
    );
}

function selectedTabName(): string | null {
    return screen.getAllByRole("tab").find(tab => tab.getAttribute("aria-selected") === "true")?.textContent ?? null;
}

describe("AppRouter", () => {
    describe("/ route", () => {
        it("redirects to /menu and renders HomePage", () => {
            renderAt("/");

            expect(screen.getByText("stub-home-page")).toBeTruthy();
        });
    });

    describe("/menu route", () => {
        it("renders HomePage", () => {
            renderAt("/menu");

            expect(screen.getByText("stub-home-page")).toBeTruthy();
        });
    });

    describe("/admin route", () => {
        it("renders AdminHomePage inside ProtectedRoute", () => {
            renderAt("/admin");

            expect(screen.getByText("stub-admin-page")).toBeTruthy();
        });

        it("renders AdminHomePage for a deep admin sub-path", () => {
            renderAt("/admin/orders");

            expect(screen.getByText("stub-admin-page")).toBeTruthy();
        });
    });

    describe("/order_status route", () => {
        it("renders OrderStatusPage", () => {
            renderAt("/order_status");

            expect(screen.getByText("stub-order-status")).toBeTruthy();
        });
    });

    describe("/auth route", () => {
        it("renders AuthPage", () => {
            renderAt("/auth");

            expect(screen.getByText("stub-auth-page")).toBeTruthy();
        });
    });

    describe("/menu/kiosk route", () => {
        it("redirects to /menu and renders HomePage", () => {
            renderAt("/menu/kiosk");

            expect(screen.getByText("stub-home-page")).toBeTruthy();
        });
    });

    describe("/privacy route", () => {
        it("opens the privacy page on the IC Pizza policy", () => {
            renderPrivacyAt("/privacy");

            expect(screen.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeTruthy();
            expect(selectedTabName()).toBe("IC Pizza (website, app, kiosk)");
        });
    });

    describe("/privacy/delivery route", () => {
        it("opens the privacy page directly on the Astra Courier policy", () => {
            renderPrivacyAt("/privacy/delivery");

            expect(screen.getByRole("heading", { level: 1, name: "Astra Courier Privacy Policy" })).toBeTruthy();
            expect(selectedTabName()).toBe("Astra Courier (delivery)");
        });

        it("swaps policy and URL both ways when the tabs are clicked", () => {
            renderPrivacyAt("/privacy");

            fireEvent.click(screen.getByRole("tab", { name: "Astra Courier (delivery)" }));
            expect(screen.getByTestId("location-probe").getAttribute("data-pathname")).toBe("/privacy/delivery");
            expect(screen.getByRole("heading", { level: 1, name: "Astra Courier Privacy Policy" })).toBeTruthy();

            fireEvent.click(screen.getByRole("tab", { name: "IC Pizza (website, app, kiosk)" }));
            expect(screen.getByTestId("location-probe").getAttribute("data-pathname")).toBe("/privacy");
            expect(screen.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeTruthy();
        });
    });
});
