import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { StaffRoles } from "../domains/auth/types";
import type { IBranch } from "../domains/management/inventory/types";
import type { UseAdminOrdersResult } from "../domains/management/orders/hooks/useAdminOrders";
import type { UseDoughResult } from "../domains/management/dough/hooks/useDough";
import type { UseOrderActionsResult } from "../domains/management/orders/hooks/useOrderActions";
import type { AdminBranchInitResult } from "../domains/management/_shared/hooks/useBranchSelection";
import type { AuthContextType } from "../domains/auth/types";

// AdminHomePage is a thin shell composing many domain components and hooks (per
// ic-client/.claude/CLAUDE.md, pages are thin shells). This test mocks every child
// component and hook so it exercises only AdminHomePage own composition logic (which
// components render for which role, and what args useAdminOrders is called with), not
// each child internals, which already have their own dedicated test files.
//
// Stub components are declared as functions whose names start with mock (rather than
// inline JSX literals inside the jest.mock factories) because babel-plugin-jest-hoist
// only allows a jest.mock factory to reference out-of-scope identifiers whose name is
// prefixed with mock -- see HistoryComponent.test.tsx for the same constraint applied
// to components this test does not need to assert on.

function mockAdminTopbar(): JSX.Element {
    return <div data-testid="admin-topbar" />;
}

function mockHistoryComponent(): JSX.Element {
    return <div data-testid="history-component" />;
}

function mockPizzaLoader(): JSX.Element {
    return <div data-testid="pizza-loader" />;
}

// Factoryless jest.mock() calls below (auto-mocked named/default exports) rather than a
// factory returning `{ useX: jest.fn() }` -- this file imports `jest` as a value from
// "@jest/globals" (per ic-client/.claude/CLAUDE.md: no @types/jest installed), which shadows
// the ambient global `jest` binding. babel-plugin-jest-hoist hoists jest.mock() calls above
// that import, so a factory referencing `jest.fn()` trips its "out-of-scope variable" guard
// (only globals/identifiers prefixed `mock` are allowed). Factoryless jest.mock() sidesteps
// this entirely (see useAdminOrders.test.ts / HistoryComponent.test.tsx for the same pattern);
// per-test return values are configured afterwards via `jest.mocked(fn).mockReturnValue(...)`.
jest.mock("../domains/auth/context/AuthProvider");
jest.mock("../domains/management/orders/hooks/useAdminOrders");
jest.mock("../domains/management/dough/hooks/useDough");
jest.mock("../domains/management/orders/hooks/useOrderActions");
jest.mock("../domains/management/_shared/hooks/useBranchSelection");
// Factoryless jest.mock() -- resolves to src/services/__mocks__/BluetoothPrinterService.ts
jest.mock("../services/BluetoothPrinterService");
// Defensive: PizzaLoader imports lottie-react, which touches a real 2D canvas context at
// import time, unavailable in jsdom -- see HistoryComponent.test.tsx for the precedent.
jest.mock("../domains/order-status/components/animations/PizzaLoader", () => ({
    __esModule: true,
    default: mockPizzaLoader,
}));
jest.mock("../domains/management/orders/components/AdminTopbar", () => ({
    __esModule: true,
    default: mockAdminTopbar,
}));
jest.mock("../domains/management/orders/components/HistoryComponent", () => ({
    __esModule: true,
    default: mockHistoryComponent,
}));
jest.mock("../domains/management/config/components/ConfigComponent", () => ({
    __esModule: true,
    default: (): null => null,
}));
jest.mock("../domains/management/statistics/components/StatisticsComponent", () => ({
    __esModule: true,
    default: (): null => null,
}));
jest.mock("../domains/management/shift/components/ShiftPopup", () => ({
    __esModule: true,
    default: (): null => null,
}));
jest.mock("../domains/management/shift/components/CashPopup", () => ({
    __esModule: true,
    default: (): null => null,
}));
jest.mock("../domains/management/orders/components/PaymentPopup", () => ({
    __esModule: true,
    default: (): null => null,
}));
jest.mock("../domains/management/orders/components/AdminPageModals", () => ({
    AdminPageModals: (): null => null,
}));
jest.mock("../domains/management/orders/components/DeleteOrderDialog", () => ({
    DeleteOrderDialog: (): null => null,
}));
jest.mock("../domains/management/orders/components/ExternalOrderAlert", () => ({
    ExternalOrderAlert: (): null => null,
}));
jest.mock("../domains/management/orders/components/EditedOrderAlert", () => ({
    EditedOrderAlert: (): null => null,
}));
jest.mock("../shared/components/ErrorSnackbar", () => ({
    __esModule: true,
    default: (): null => null,
}));

import { useAuth } from "../domains/auth/context/AuthProvider";
import { useAdminOrders } from "../domains/management/orders/hooks/useAdminOrders";
import { useDough } from "../domains/management/dough/hooks/useDough";
import { useOrderActions } from "../domains/management/orders/hooks/useOrderActions";
import { useAdminBranchInit } from "../domains/management/_shared/hooks/useBranchSelection";
import BluetoothPrinterService from "../services/BluetoothPrinterService";
import AdminHomePage from "./AdminHomePage";

const mockUseAuth = jest.mocked(useAuth);
const mockUseAdminOrders = jest.mocked(useAdminOrders);
const mockUseDough = jest.mocked(useDough);
const mockUseOrderActions = jest.mocked(useOrderActions);
const mockUseAdminBranchInit = jest.mocked(useAdminBranchInit);

// services/__mocks__/BluetoothPrinterService.ts (the shared manual mock, owned by another
// domain) only stubs `init`/`printOrder` -- AdminHomePage also calls `connect` and
// `startConnectionMonitor` unconditionally on mount (for every role, including REVIEWER;
// out of scope for this task per task-spec.md PHASE 1.1 Out of scope). Patch the missing
// methods onto the already-mocked module object directly (not inside a jest.mock factory,
// so the "mock"-prefix hoisting rule does not apply here), same technique as
// HistoryComponent.test.tsx patching `deleteOrder`/`updateOrderStatus` onto the public.ts mock.
const mockBtConnect = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);
const mockBtStartConnectionMonitor = jest.fn<void, []>();
(BluetoothPrinterService as unknown as { connect: unknown }).connect = mockBtConnect;
(BluetoothPrinterService as unknown as { startConnectionMonitor: unknown }).startConnectionMonitor = mockBtStartConnectionMonitor;

const testBranch: IBranch = { id: "branch-1", externalId: "ext-1", branchNo: 1, branchName: "Test Branch", locale: "en" };

function authValue(role: StaffRoles | null): AuthContextType {
    return {
        branchId: "branch-1",
        username: "test-user",
        userId: 1,
        role,
        logout: jest.fn(),
        login: jest.fn(),
        isAuthLoading: false,
    };
}

function adminOrdersValue(): UseAdminOrdersResult {
    return {
        orders: [],
        setOrders: jest.fn(),
        alertOrder: null,
        setAlertOrder: jest.fn(),
        editedOrder: null,
        setEditedOrder: jest.fn(),
        workloadLevel: "IDLE",
        setWorkloadLevel: jest.fn(),
        cashStage: "OPEN_SHIFT_CASH_CHECK",
        eventStage: "OPEN_SHIFT_EVENT",
        doughStatus: null,
        setDoughStatus: jest.fn(),
        doughAlertOpen: false,
        doughAlertMessage: "",
        clearDoughAlert: jest.fn(),
        loading: false,
    };
}

function doughValue(): UseDoughResult {
    return {
        doughLoading: false,
        onDoughInventoryChange: jest.fn(),
        onDoughAvailabilityToggle: jest.fn(async () => undefined),
    };
}

function orderActionsValue(): UseOrderActionsResult {
    return {
        confirmingAccept: false,
        confirmingCancel: false,
        cancelReason: "",
        setCancelReason: jest.fn(),
        cancelDialogOpen: false,
        setCancelDialogOpen: jest.fn(),
        confirmExternalOrder: jest.fn(async () => undefined),
        handleCancel: jest.fn(async () => undefined),
    };
}

function branchInitValue(): AdminBranchInitResult {
    return {
        availableBranches: [testBranch],
        selectedBranch: testBranch,
        setSelectedBranch: jest.fn(),
        branchError: null,
    };
}

function renderAdminHomePage(role: StaffRoles | null): void {
    mockUseAuth.mockReturnValue(authValue(role));
    mockUseAdminOrders.mockReturnValue(adminOrdersValue());
    mockUseDough.mockReturnValue(doughValue());
    mockUseOrderActions.mockReturnValue(orderActionsValue());
    mockUseAdminBranchInit.mockReturnValue(branchInitValue());

    render(
        <MemoryRouter>
            <AdminHomePage />
        </MemoryRouter>
    );
}

describe("AdminHomePage REVIEWER role", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("renders HistoryComponent and no order-board grid when role is REVIEWER", () => {
        renderAdminHomePage(StaffRoles.REVIEWER);

        expect(screen.getByTestId("history-component")).toBeTruthy();
        // DoughSection renders a "S Dough" label, whose absence proves the order-board
        // grid (which DoughSection lives inside) did not render for a REVIEWER.
        expect(screen.queryByText("S Dough")).toBeNull();
    });

    it("calls useAdminOrders with enabled=false when role is REVIEWER", () => {
        renderAdminHomePage(StaffRoles.REVIEWER);

        expect(mockUseAdminOrders).toHaveBeenCalledWith("branch-1", expect.any(Function), false);
    });

    it("calls useAdminOrders with enabled=true when role is MANAGER, a regression guard", () => {
        renderAdminHomePage(StaffRoles.MANAGER);

        expect(mockUseAdminOrders).toHaveBeenCalledWith("branch-1", expect.any(Function), true);
        expect(screen.queryByTestId("history-component")).toBeNull();
    });
});
