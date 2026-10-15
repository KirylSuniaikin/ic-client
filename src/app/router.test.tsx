import { jest, describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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
});
