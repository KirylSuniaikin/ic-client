import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
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

// Stub AdminSurfaceTabs so tab switching can be driven without depending on
// ToggleButtonGroup internals (the real component already has its own dedicated
// AdminSurfaceTabs.test.tsx). Echoes activeTab into the DOM for assertions and
// exposes two clickable elements that call onChange with 'orders' / 'board'.
// AdminHomePage itself does not gate the <AdminSurfaceTabs/> render call on role --
// per the spec, that allowlist check lives inside AdminSurfaceTabs -- so this stub
// must replicate it, or the role-gating tests below would exercise nothing real.
function mockAdminSurfaceTabs({ role, activeTab, onChange }: { role: StaffRoles | null; activeTab: string; onChange: (v: "orders" | "board") => void }): JSX.Element | null {
    if (role !== StaffRoles.MANAGER && role !== StaffRoles.SUPER_MANAGER && role !== StaffRoles.OWNER) return null;

    return (
        <div data-testid="admin-surface-tabs" data-active-tab={activeTab}>
            <button data-testid="admin-tab-orders" onClick={() => onChange("orders")}>Order Desk</button>
            <button data-testid="admin-tab-board" onClick={() => onChange("board")}>Task Board</button>
        </div>
    );
}

// Stub TaskBoardScreen (ST6) so tab-switching tests can assert AdminHomePage's own wiring
// (which component renders for which tab, and what `role` prop TaskBoardScreen receives)
// without depending on TaskBoardScreen's internals (sidebar fetch/selection state), which
// already have their own dedicated TaskBoardScreen.test.tsx. This stub only proves
// AdminHomePage passes `role` through to TaskBoardScreen unmodified for every
// board-eligible role (MANAGER/SUPER_MANAGER/OWNER) — the actual OWNER-only sidebar
// gating rule lives inside TaskBoardScreen and is covered by TaskBoardScreen.test.tsx.
function mockTaskBoardScreen({ role }: { role: StaffRoles | null }): JSX.Element {
    return (
        <div data-testid="task-board-panel">
            {role === StaffRoles.OWNER && <div data-testid="staff-board-sidebar-stub" />}
        </div>
    );
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
jest.mock("../domains/management/_shared/components/AdminSurfaceTabs", () => ({
    __esModule: true,
    default: mockAdminSurfaceTabs,
}));
jest.mock("../domains/management/tasks/components/TaskBoardScreen", () => ({
    __esModule: true,
    default: mockTaskBoardScreen,
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

    // A MANAGER now lands on the board, so the order desk's subscriptions start torn down and are
    // established on the way to the orders tab. Both directions are asserted: leaving the socket
    // permanently off would silently stop the order board updating.
    it("keeps useAdminOrders disabled while a MANAGER is on the board tab", () => {
        renderAdminHomePage(StaffRoles.MANAGER);

        expect(mockUseAdminOrders).toHaveBeenCalledWith("branch-1", expect.any(Function), false);
        expect(screen.queryByTestId("history-component")).toBeNull();
    });

    it("enables useAdminOrders once a MANAGER switches to the orders tab", () => {
        renderAdminHomePage(StaffRoles.MANAGER);

        fireEvent.click(screen.getByTestId("admin-tab-orders"));

        expect(mockUseAdminOrders).toHaveBeenLastCalledWith("branch-1", expect.any(Function), true);
    });

    it("keeps useAdminOrders enabled for a non-manager, who has no board to switch to", () => {
        renderAdminHomePage(StaffRoles.COOK);

        expect(mockUseAdminOrders).toHaveBeenLastCalledWith("branch-1", expect.any(Function), true);
    });
});

describe("AdminHomePage board tab gating", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("does not render AdminSurfaceTabs for role COOK", () => {
        renderAdminHomePage(StaffRoles.COOK);

        expect(screen.queryByTestId("admin-surface-tabs")).toBeNull();
    });

    it("does not render AdminSurfaceTabs for role SUPERVISOR", () => {
        renderAdminHomePage(StaffRoles.SUPERVISOR);

        expect(screen.queryByTestId("admin-surface-tabs")).toBeNull();
    });

    it("does not render AdminSurfaceTabs for role REVIEWER", () => {
        renderAdminHomePage(StaffRoles.REVIEWER);

        expect(screen.queryByTestId("admin-surface-tabs")).toBeNull();
    });

    it("does not render AdminSurfaceTabs for a null role", () => {
        renderAdminHomePage(null);

        expect(screen.queryByTestId("admin-surface-tabs")).toBeNull();
    });

    it("opens on the task board, not the order desk, for role MANAGER", () => {
        renderAdminHomePage(StaffRoles.MANAGER);

        expect(screen.getByTestId("admin-surface-tabs")).toBeTruthy();
        expect(screen.getByTestId("task-board-panel")).toBeTruthy();
        expect(screen.queryByText("S Dough")).toBeNull();
    });

    it("opens on the task board, not the order desk, for role SUPER_MANAGER", () => {
        renderAdminHomePage(StaffRoles.SUPER_MANAGER);

        expect(screen.getByTestId("admin-surface-tabs")).toBeTruthy();
        expect(screen.getByTestId("task-board-panel")).toBeTruthy();
        expect(screen.queryByText("S Dough")).toBeNull();
    });

    it("opens on the task board, not the order desk, for role OWNER", () => {
        renderAdminHomePage(StaffRoles.OWNER);

        expect(screen.getByTestId("admin-surface-tabs")).toBeTruthy();
        expect(screen.getByTestId("task-board-panel")).toBeTruthy();
        expect(screen.queryByText("S Dough")).toBeNull();
    });

    it("switches both ways between the board and the order desk, for role MANAGER", () => {
        renderAdminHomePage(StaffRoles.MANAGER);

        // Manager-and-above land on the board; the order desk is one tap away.
        expect(screen.getByTestId("task-board-panel")).toBeTruthy();
        expect(screen.queryByText("S Dough")).toBeNull();

        fireEvent.click(screen.getByTestId("admin-tab-orders"));

        expect(screen.queryByText("S Dough")).toBeTruthy();
        expect(screen.queryByTestId("task-board-panel")).toBeNull();

        fireEvent.click(screen.getByTestId("admin-tab-board"));

        expect(screen.getByTestId("task-board-panel")).toBeTruthy();
        expect(screen.queryByText("S Dough")).toBeNull();
    });

    // The other half of the isManagerRole branch: a role with no board access must still land on
    // the order desk, not on a board it has no tab to leave.
    it("opens on the order desk for a non-manager role", () => {
        renderAdminHomePage(StaffRoles.COOK);

        expect(screen.queryByText("S Dough")).toBeTruthy();
        expect(screen.queryByTestId("task-board-panel")).toBeNull();
    });

    it("switching to the board tab renders TaskBoardScreen with role passed through, for role MANAGER", () => {
        renderAdminHomePage(StaffRoles.MANAGER);

        fireEvent.click(screen.getByTestId("admin-tab-board"));

        expect(screen.getByTestId("task-board-panel")).toBeTruthy();
        expect(screen.queryByTestId("staff-board-sidebar-stub")).toBeNull();
    });

    it("switching to the board tab renders TaskBoardScreen with the sidebar stub absent, for role SUPER_MANAGER", () => {
        renderAdminHomePage(StaffRoles.SUPER_MANAGER);

        fireEvent.click(screen.getByTestId("admin-tab-board"));

        expect(screen.getByTestId("task-board-panel")).toBeTruthy();
        expect(screen.queryByTestId("staff-board-sidebar-stub")).toBeNull();
    });

    it("switching to the board tab renders TaskBoardScreen with role passed through, for role OWNER", () => {
        renderAdminHomePage(StaffRoles.OWNER);

        fireEvent.click(screen.getByTestId("admin-tab-board"));

        expect(screen.getByTestId("task-board-panel")).toBeTruthy();
        expect(screen.getByTestId("staff-board-sidebar-stub")).toBeTruthy();
    });
});
