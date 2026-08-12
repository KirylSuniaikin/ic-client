import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import type { BoardOwner } from "../types";
import { StaffRoles } from "../../../auth/types";
import StaffBoardSidebar from "./StaffBoardSidebar";
import type { StaffBoardSidebarProps } from "./StaffBoardSidebar";

function makeOwner(overrides: Partial<BoardOwner> = {}): BoardOwner {
    return {
        id: 1,
        username: "owner",
        role: StaffRoles.MANAGER,
        ...overrides,
    };
}

// Deliberately non-alphabetical: caller pinned first ("riley"), then two others out of
// alphabetical order, to prove the sidebar does no client-side sorting (Q1 decision (c)).
const nonAlphabeticalOwners: BoardOwner[] = [
    makeOwner({ id: 9, username: "riley.super", role: StaffRoles.SUPER_MANAGER }),
    makeOwner({ id: 4, username: "zara.manager" }),
    makeOwner({ id: 2, username: "avery.manager" }),
];

function baseProps(overrides: Partial<StaffBoardSidebarProps> = {}): StaffBoardSidebarProps {
    return {
        owners: nonAlphabeticalOwners,
        loading: false,
        selectedOwnerId: null,
        open: true,
        onToggle: jest.fn(),
        onSelect: jest.fn(),
        ...overrides,
    };
}

describe("StaffBoardSidebar", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("renders one row per owner, in the exact input order", () => {
        render(<StaffBoardSidebar {...baseProps()} />);

        const list = screen.getByTestId("staff-board-sidebar-list");
        const rows = list.querySelectorAll("[data-testid^='staff-board-sidebar-row-']");
        expect(rows).toHaveLength(3);
        expect(Array.from(rows).map(row => row.getAttribute("data-testid"))).toEqual([
            "staff-board-sidebar-row-9",
            "staff-board-sidebar-row-4",
            "staff-board-sidebar-row-2",
        ]);
        expect(screen.getByText("riley.super")).toBeTruthy();
        expect(screen.getByText("zara.manager")).toBeTruthy();
        expect(screen.getByText("avery.manager")).toBeTruthy();
    });

    it("visually distinguishes the row matching selectedOwnerId via the Mui-selected class", () => {
        render(<StaffBoardSidebar {...baseProps({ selectedOwnerId: 4 })} />);

        const selectedRow = screen.getByTestId("staff-board-sidebar-row-4");
        const otherRow = screen.getByTestId("staff-board-sidebar-row-9");

        expect(selectedRow.className).toEqual(expect.stringContaining("Mui-selected"));
        expect(otherRow.className).not.toEqual(expect.stringContaining("Mui-selected"));
    });

    it("renders zero rows when open=false but keeps the toggle visible", () => {
        render(<StaffBoardSidebar {...baseProps({ open: false })} />);

        expect(screen.queryByTestId("staff-board-sidebar-list")).toBeNull();
        expect(screen.queryByTestId(/staff-board-sidebar-row-/)).toBeNull();
        expect(screen.getByTestId("staff-board-sidebar-toggle")).toBeTruthy();
    });

    it("renders all rows when open=true", () => {
        render(<StaffBoardSidebar {...baseProps({ open: true })} />);

        expect(screen.getByTestId("staff-board-sidebar-list")).toBeTruthy();
        expect(screen.getByTestId("staff-board-sidebar-row-9")).toBeTruthy();
        expect(screen.getByTestId("staff-board-sidebar-row-4")).toBeTruthy();
        expect(screen.getByTestId("staff-board-sidebar-row-2")).toBeTruthy();
    });

    it("clicking a row calls onSelect with that row's id", () => {
        const onSelect = jest.fn();
        render(<StaffBoardSidebar {...baseProps({ onSelect })} />);

        fireEvent.click(screen.getByTestId("staff-board-sidebar-row-4"));

        expect(onSelect).toHaveBeenCalledWith(4);
        expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it("clicking the toggle calls onToggle and does not call onSelect", () => {
        const onToggle = jest.fn();
        const onSelect = jest.fn();
        render(<StaffBoardSidebar {...baseProps({ onToggle, onSelect })} />);

        fireEvent.click(screen.getByTestId("staff-board-sidebar-toggle"));

        expect(onToggle).toHaveBeenCalledTimes(1);
        expect(onSelect).not.toHaveBeenCalled();
    });

    it("shows a loading indicator instead of rows while loading with no owners yet", () => {
        render(<StaffBoardSidebar {...baseProps({ owners: [], loading: true })} />);

        expect(screen.getByTestId("staff-board-sidebar-loading")).toBeTruthy();
        expect(screen.queryByTestId("staff-board-sidebar-list")).toBeNull();
    });
});
