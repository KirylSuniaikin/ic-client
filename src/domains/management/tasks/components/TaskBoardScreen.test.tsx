import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { StaffRoles } from "../../../auth/types";
import type { BoardOwner } from "../types";
import type { UseBoardOwnersResult } from "../hooks/useBoardOwners";

// Stub TaskBoardPanel so TaskBoardScreen's own composition (which ownerId it passes
// through) can be asserted without depending on TaskBoardPanel's internals -- that
// component already has its own dedicated TaskBoardPanel.test.tsx. Echoes ownerId
// into a data attribute so tests can assert its value across re-renders.
function mockTaskBoardPanel({ ownerId }: { ownerId?: number | null }): JSX.Element {
    return <div data-testid="task-board-panel" data-owner-id={ownerId === undefined || ownerId === null ? "" : String(ownerId)} />;
}

jest.mock("./TaskBoardPanel", () => ({
    __esModule: true,
    default: mockTaskBoardPanel,
}));

// Factoryless jest.mock() on the hook -- isolates TaskBoardScreen's own composition logic
// (sidebar visibility by role, selected-owner state, error mirroring) from useBoardOwners'
// internals, which already have their own dedicated useBoardOwners.test.ts.
jest.mock("../hooks/useBoardOwners");

import { useBoardOwners } from "../hooks/useBoardOwners";
import TaskBoardScreen from "./TaskBoardScreen";

const mockUseBoardOwners = jest.mocked(useBoardOwners);

function makeOwner(overrides: Partial<BoardOwner> = {}): BoardOwner {
    return {
        id: 12,
        username: "avery.super",
        role: StaffRoles.SUPER_MANAGER,
        ...overrides,
    };
}

function boardOwnersValue(overrides: Partial<UseBoardOwnersResult> = {}): UseBoardOwnersResult {
    return {
        owners: [],
        loading: false,
        error: null,
        ...overrides,
    };
}

function getOwnerId(): string | null {
    return screen.getByTestId("task-board-panel").getAttribute("data-owner-id");
}

describe("TaskBoardScreen", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUseBoardOwners.mockReturnValue(boardOwnersValue());
    });

    it("role=MANAGER: sidebar absent, TaskBoardPanel rendered with no ownerId", () => {
        render(<TaskBoardScreen role={StaffRoles.MANAGER} />);

        expect(screen.queryByTestId("staff-board-sidebar")).toBeNull();
        expect(screen.getByTestId("task-board-panel")).toBeTruthy();
        expect(getOwnerId()).toBe("");
    });

    it("role=null: same as MANAGER — no sidebar, no ownerId", () => {
        render(<TaskBoardScreen role={null} />);

        expect(screen.queryByTestId("staff-board-sidebar")).toBeNull();
        expect(getOwnerId()).toBe("");
    });

    it("role=MANAGER: does not call the owners fetch (useBoardOwners called with enabled=false)", () => {
        render(<TaskBoardScreen role={StaffRoles.MANAGER} />);

        expect(mockUseBoardOwners).toHaveBeenCalledWith(false);
    });

    it("role=SUPER_MANAGER: sidebar present, useBoardOwners called with enabled=true", () => {
        mockUseBoardOwners.mockReturnValue(boardOwnersValue({ owners: [makeOwner()] }));

        render(<TaskBoardScreen role={StaffRoles.SUPER_MANAGER} />);

        expect(screen.getByTestId("staff-board-sidebar")).toBeTruthy();
        expect(mockUseBoardOwners).toHaveBeenCalledWith(true);
    });

    it("role=SUPER_MANAGER: TaskBoardPanel initially receives ownerId equal to the first owner's id", async () => {
        const owners = [makeOwner({ id: 12 }), makeOwner({ id: 4, username: "casey.manager", role: StaffRoles.MANAGER })];
        mockUseBoardOwners.mockReturnValue(boardOwnersValue({ owners }));

        render(<TaskBoardScreen role={StaffRoles.SUPER_MANAGER} />);

        await waitFor(() => {
            expect(getOwnerId()).toBe("12");
        });
    });

    it("role=SUPER_MANAGER: clicking a non-first sidebar entry updates TaskBoardPanel's ownerId", async () => {
        const owners = [
            makeOwner({ id: 12 }),
            makeOwner({ id: 4, username: "casey.manager", role: StaffRoles.MANAGER }),
            makeOwner({ id: 9, username: "riley.manager", role: StaffRoles.MANAGER }),
        ];
        mockUseBoardOwners.mockReturnValue(boardOwnersValue({ owners }));

        render(<TaskBoardScreen role={StaffRoles.SUPER_MANAGER} />);

        await waitFor(() => {
            expect(getOwnerId()).toBe("12");
        });

        fireEvent.click(screen.getByTestId("staff-board-sidebar-row-9"));

        await waitFor(() => {
            expect(getOwnerId()).toBe("9");
        });
    });

    it("role=SUPER_MANAGER: toggling the sidebar closed then open does not change the selected ownerId", async () => {
        const owners = [makeOwner({ id: 12 }), makeOwner({ id: 4, username: "casey.manager", role: StaffRoles.MANAGER })];
        mockUseBoardOwners.mockReturnValue(boardOwnersValue({ owners }));

        render(<TaskBoardScreen role={StaffRoles.SUPER_MANAGER} />);

        await waitFor(() => {
            expect(getOwnerId()).toBe("12");
        });

        fireEvent.click(screen.getByTestId("staff-board-sidebar-toggle"));
        expect(screen.getByTestId("staff-board-sidebar").getAttribute("data-open")).toBe("false");
        expect(getOwnerId()).toBe("12");

        fireEvent.click(screen.getByTestId("staff-board-sidebar-toggle"));
        expect(screen.getByTestId("staff-board-sidebar").getAttribute("data-open")).toBe("true");
        expect(getOwnerId()).toBe("12");
    });

    it("role=SUPER_MANAGER: a useBoardOwners error surfaces via ErrorSnackbar and TaskBoardPanel still renders with the fallback (self) ownerId", () => {
        mockUseBoardOwners.mockReturnValue(boardOwnersValue({ owners: [], error: "HTTP 500" }));

        render(<TaskBoardScreen role={StaffRoles.SUPER_MANAGER} />);

        expect(screen.getByText("HTTP 500")).toBeTruthy();
        expect(getOwnerId()).toBe("");
    });
});
