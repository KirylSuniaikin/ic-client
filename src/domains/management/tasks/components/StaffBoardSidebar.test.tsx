import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import type { BoardOwner } from "../types";
import { StaffRoles } from "../../../auth/types";
import StaffBoardSidebar from "./StaffBoardSidebar";
import type { StaffBoardSidebarProps } from "./StaffBoardSidebar";

function makeOwner(overrides: Partial<BoardOwner> = {}): BoardOwner {
    return {
        id: 1,
        username: "owner",
        role: StaffRoles.MANAGER,
        openCardCount: 0,
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

    // The badge answers "who is loaded up" at a glance, so it has to survive the collapsed rail
    // (where the avatar is the only thing left) and stay off an empty board.
    describe("open-card badge", () => {
        // The testid is on the badge's root, which also wraps the avatar — scope the text query to
        // it rather than reading its textContent, which would include the initials.
        const badgeFor = (ownerId: number) =>
            within(screen.getByTestId(`staff-board-sidebar-avatar-${ownerId}`));

        it("shows each owner's open-card count on their avatar", () => {
            render(<StaffBoardSidebar {...baseProps({ owners: [
                makeOwner({ id: 9, username: "riley.super", openCardCount: 3 }),
                makeOwner({ id: 4, username: "zara.manager", openCardCount: 12 }),
            ] })} />);

            expect(badgeFor(9).getByText("3")).toBeTruthy();
            expect(badgeFor(4).getByText("12")).toBeTruthy();
        });

        it("shows no number at all for someone with nothing outstanding", () => {
            render(<StaffBoardSidebar {...baseProps({ owners: [
                makeOwner({ id: 9, username: "riley.super", openCardCount: 0 }),
            ] })} />);

            // A zero on every idle avatar is noise to read past, so MUI's default (hide at 0) stands.
            expect(badgeFor(9).queryByText("0")).toBeNull();
        });

        it("caps a very long count rather than widening the row", () => {
            render(<StaffBoardSidebar {...baseProps({ owners: [
                makeOwner({ id: 9, username: "riley.super", openCardCount: 250 }),
            ] })} />);

            expect(badgeFor(9).getByText("99+")).toBeTruthy();
        });

        it("keeps the count visible when the sidebar is collapsed to the avatar rail", () => {
            render(<StaffBoardSidebar {...baseProps({
                open: false,
                owners: [makeOwner({ id: 9, username: "riley.super", openCardCount: 5 })],
            })} />);

            expect(screen.getByTestId("staff-board-sidebar").getAttribute("data-open")).toBe("false");
            expect(screen.queryByText("riley.super")).toBeNull();
            expect(badgeFor(9).getByText("5")).toBeTruthy();
        });
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

    it("collapses to an avatar rail when open=false: rows stay selectable, names are hidden", () => {
        render(<StaffBoardSidebar {...baseProps({ open: false })} />);

        expect(screen.getByTestId("staff-board-sidebar").getAttribute("data-open")).toBe("false");
        // The rail keeps every board reachable — collapsing must not strand the other boards.
        expect(screen.getByTestId("staff-board-sidebar-row-9")).toBeTruthy();
        expect(screen.queryByText("riley.super")).toBeNull();
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
