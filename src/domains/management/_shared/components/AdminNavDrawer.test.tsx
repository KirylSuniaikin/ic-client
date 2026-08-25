import { jest, describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import AdminNavDrawer from "./AdminNavDrawer";
import type { AdminNavHandlers } from "./adminNavItems";
import { StaffRoles } from "../../../auth/types";

function makeHandlers(): AdminNavHandlers {
    return {
        onGoToMenu: jest.fn(),
        onShiftManagementPageOpen: jest.fn(),
        onOpenHistory: jest.fn(),
        onOpenConfig: jest.fn(),
        onOpenStatistics: jest.fn(),
        onManagementPageOpen: jest.fn(),
        onPurchaseOpen: jest.fn(),
        onCashRegisterOpen: jest.fn(),
        onAccountingOpen: jest.fn(),
        onBlacklistopen: jest.fn(),
    onAccountManagerOpen: jest.fn(),
        logout: jest.fn(),
    };
}

const getCashStage = (stage: string): string => (stage === "OPEN_SHIFT_CASH_CHECK" ? "Open Cash" : "Close Cash");
const getShiftStage = (stage: string): string => (stage === "OPEN_SHIFT_EVENT" ? "Open Shift" : "Close Shift");

function renderDrawer(role: StaffRoles | null, handlers: AdminNavHandlers, onClose = jest.fn()) {
    render(
        <AdminNavDrawer
            open
            onClose={onClose}
            role={role}
            userName="Test User"
            cashStage="OPEN_SHIFT_CASH_CHECK"
            shiftStage="OPEN_SHIFT_EVENT"
            onCashClick={jest.fn()}
            onShiftStageClick={jest.fn()}
            getCashStage={getCashStage}
            getShiftStage={getShiftStage}
            handlers={handlers}
        />
    );
    return onClose;
}

describe("AdminNavDrawer", () => {
    it("renders the Operations / Money / Management captions in that order for a MANAGER", () => {
        renderDrawer(StaffRoles.MANAGER, makeHandlers());

        const operations = screen.getByText("Operations");
        const money = screen.getByText("Money");
        const management = screen.getByText("Management");

        expect(operations.compareDocumentPosition(money) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(money.compareDocumentPosition(management) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("renders the promoted Cash/Shift buttons above the grouped sections", () => {
        renderDrawer(StaffRoles.MANAGER, makeHandlers());

        const openCash = screen.getByText("Open Cash");
        const operations = screen.getByText("Operations");

        expect(openCash.compareDocumentPosition(operations) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("hides the promoted Cash/Shift buttons for a REVIEWER", () => {
        renderDrawer(StaffRoles.REVIEWER, makeHandlers());

        expect(screen.queryByText("Open Cash")).toBeNull();
        expect(screen.queryByText("Open Shift")).toBeNull();
    });

    it("renders Logout below a divider, after every section", () => {
        renderDrawer(StaffRoles.MANAGER, makeHandlers());

        const divider = screen.getByRole("separator");
        const logout = screen.getByText("Logout");
        const management = screen.getByText("Management");

        expect(management.compareDocumentPosition(divider) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(divider.compareDocumentPosition(logout) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("closes the drawer then invokes the handler when a section row is clicked", () => {
        const handlers = makeHandlers();
        const onClose = renderDrawer(StaffRoles.MANAGER, handlers);

        fireEvent.click(screen.getByText("Purchase"));

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(handlers.onPurchaseOpen).toHaveBeenCalledTimes(1);
    });

    it("closes the drawer then invokes logout when the Logout row is clicked", () => {
        const handlers = makeHandlers();
        const onClose = renderDrawer(StaffRoles.MANAGER, handlers);

        fireEvent.click(screen.getByText("Logout"));

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(handlers.logout).toHaveBeenCalledTimes(1);
    });

    it("renders the userName and role in the header, and closes on the close button", () => {
        const onClose = renderDrawer(StaffRoles.MANAGER, makeHandlers());

        expect(screen.getByText("Test User")).toBeTruthy();
        expect(screen.getByText(StaffRoles.MANAGER)).toBeTruthy();

        fireEvent.click(screen.getByLabelText("Close"));

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("closes the drawer BEFORE invoking a section row's handler, not after (ordering)", () => {
        const calls: string[] = [];
        const onClose = jest.fn(() => calls.push("close"));
        const handlers = makeHandlers();
        handlers.onPurchaseOpen = jest.fn(() => calls.push("handler"));
        renderDrawer(StaffRoles.MANAGER, handlers, onClose);

        fireEvent.click(screen.getByText("Purchase"));

        expect(calls).toEqual(["close", "handler"]);
    });

    it("closes the drawer BEFORE invoking logout, not after (ordering)", () => {
        const calls: string[] = [];
        const onClose = jest.fn(() => calls.push("close"));
        const handlers = makeHandlers();
        handlers.logout = jest.fn(() => calls.push("handler"));
        renderDrawer(StaffRoles.MANAGER, handlers, onClose);

        fireEvent.click(screen.getByText("Logout"));

        expect(calls).toEqual(["close", "handler"]);
    });

    it("closes the drawer BEFORE invoking the promoted Cash button's handler, not after (ordering)", () => {
        const calls: string[] = [];
        const onClose = jest.fn(() => calls.push("close"));
        const onCashClick = jest.fn(() => calls.push("handler"));
        render(
            <AdminNavDrawer
                open
                onClose={onClose}
                role={StaffRoles.MANAGER}
                userName="Test User"
                cashStage="OPEN_SHIFT_CASH_CHECK"
                shiftStage="OPEN_SHIFT_EVENT"
                onCashClick={onCashClick}
                onShiftStageClick={jest.fn()}
                getCashStage={getCashStage}
                getShiftStage={getShiftStage}
                handlers={makeHandlers()}
            />
        );

        fireEvent.click(screen.getByText("Open Cash"));

        expect(calls).toEqual(["close", "handler"]);
    });

    it("does not render section captions with no items for that role (REVIEWER: only Operations)", () => {
        renderDrawer(StaffRoles.REVIEWER, makeHandlers());

        expect(screen.getByText("Operations")).toBeTruthy();
        expect(screen.queryByText("Money")).toBeNull();
        expect(screen.queryByText("Management")).toBeNull();
    });
});
