import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { StaffRoles } from "../../../auth/types";
import type { BoardOwner } from "../types";
import type { UseBoardOwnersResult } from "../hooks/useBoardOwners";

// Stub TaskBoardPanel so TaskBoardScreen's own composition (which ownerId it passes
// through) can be asserted without depending on TaskBoardPanel's internals -- that
// component already has its own dedicated TaskBoardPanel.test.tsx. Echoes ownerId
// into a data attribute so tests can assert its value across re-renders.
function mockTaskBoardPanel({ ownerId, onOpenCardCountChange }: {
    ownerId?: number | null;
    onOpenCardCountChange?: (ownerId: number | null, openCardCount: number) => void;
}): JSX.Element {
    return (
        <div data-testid="task-board-panel" data-owner-id={ownerId === undefined || ownerId === null ? "" : String(ownerId)}>
            {/* Stands in for the real panel's effect: a card was added/moved/deleted and the board
                now holds this many unfinished cards. */}
            <button
                data-testid="panel-reports-4-open-cards"
                onClick={(): void => onOpenCardCountChange?.(ownerId ?? null, 4)}
            />
        </div>
    );
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
        username: "avery.owner",
        role: StaffRoles.OWNER,
        openCardCount: 0,
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

// jsdom implements no `matchMedia`, so MUI's `useMediaQuery` falls back to false (desktop) for
// every test that does not install this.
function stubViewportAsMobile(matches: boolean): void {
    Object.defineProperty(window, "matchMedia", {
        writable: true,
        configurable: true,
        value: (query: string) => ({
            matches,
            media: query,
            onchange: null,
            addListener: jest.fn(),
            removeListener: jest.fn(),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            dispatchEvent: jest.fn(),
        }),
    });
}

describe("TaskBoardScreen", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUseBoardOwners.mockReturnValue(boardOwnersValue());
    });

    afterEach(() => {
        Reflect.deleteProperty(window, "matchMedia");
    });

    it("starts the sidebar collapsed on a phone, where expanded would leave the board half a screen", () => {
        stubViewportAsMobile(true);

        render(<TaskBoardScreen role={StaffRoles.OWNER} />);

        expect(screen.getByTestId("staff-board-sidebar").getAttribute("data-open")).toBe("false");
    });

    it("starts the sidebar expanded on desktop", () => {
        stubViewportAsMobile(false);

        render(<TaskBoardScreen role={StaffRoles.OWNER} />);

        expect(screen.getByTestId("staff-board-sidebar").getAttribute("data-open")).toBe("true");
    });

    // The count comes down with the owners list, but the board on screen is the thing being
    // edited — a badge that only reflected page-load state would be wrong the moment a card moved.
    describe("open-card badge", () => {
        const badgeFor = (ownerId: number) =>
            within(screen.getByTestId(`staff-board-sidebar-avatar-${ownerId}`));

        it("badges each owner with the count that came down with the list", async () => {
            mockUseBoardOwners.mockReturnValue(boardOwnersValue({
                owners: [
                    makeOwner({ id: 12, openCardCount: 7 }),
                    makeOwner({ id: 4, username: "casey.manager", role: StaffRoles.MANAGER, openCardCount: 2 }),
                ],
            }));

            render(<TaskBoardScreen role={StaffRoles.OWNER} />);

            await waitFor(() => expect(badgeFor(12).getByText("7")).toBeTruthy());
            expect(badgeFor(4).getByText("2")).toBeTruthy();
        });

        it("takes the live count from the board on screen over the fetched one", async () => {
            mockUseBoardOwners.mockReturnValue(boardOwnersValue({
                owners: [makeOwner({ id: 12, openCardCount: 7 })],
            }));

            render(<TaskBoardScreen role={StaffRoles.OWNER} />);
            await waitFor(() => expect(badgeFor(12).getByText("7")).toBeTruthy());

            fireEvent.click(screen.getByTestId("panel-reports-4-open-cards"));

            await waitFor(() => expect(badgeFor(12).getByText("4")).toBeTruthy());
            expect(badgeFor(12).queryByText("7")).toBeNull();
        });

        it("leaves the other owners' badges untouched", async () => {
            mockUseBoardOwners.mockReturnValue(boardOwnersValue({
                owners: [
                    makeOwner({ id: 12, openCardCount: 7 }),
                    makeOwner({ id: 4, username: "casey.manager", role: StaffRoles.MANAGER, openCardCount: 2 }),
                ],
            }));

            render(<TaskBoardScreen role={StaffRoles.OWNER} />);
            await waitFor(() => expect(badgeFor(12).getByText("7")).toBeTruthy());

            fireEvent.click(screen.getByTestId("panel-reports-4-open-cards"));

            await waitFor(() => expect(badgeFor(12).getByText("4")).toBeTruthy());
            expect(badgeFor(4).getByText("2")).toBeTruthy();
        });
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

    // SUPER_MANAGER now drops to "own board only", identical to MANAGER — the multi-owner
    // sidebar (and its underlying board_owners fetch) is OWNER-exclusive.
    it("role=SUPER_MANAGER: sidebar absent, TaskBoardPanel rendered with no ownerId", () => {
        render(<TaskBoardScreen role={StaffRoles.SUPER_MANAGER} />);

        expect(screen.queryByTestId("staff-board-sidebar")).toBeNull();
        expect(screen.getByTestId("task-board-panel")).toBeTruthy();
        expect(getOwnerId()).toBe("");
    });

    it("role=SUPER_MANAGER: does not call the owners fetch (useBoardOwners called with enabled=false)", () => {
        render(<TaskBoardScreen role={StaffRoles.SUPER_MANAGER} />);

        expect(mockUseBoardOwners).toHaveBeenCalledWith(false);
    });

    it("role=OWNER: sidebar present, useBoardOwners called with enabled=true", () => {
        mockUseBoardOwners.mockReturnValue(boardOwnersValue({ owners: [makeOwner()] }));

        render(<TaskBoardScreen role={StaffRoles.OWNER} />);

        expect(screen.getByTestId("staff-board-sidebar")).toBeTruthy();
        expect(mockUseBoardOwners).toHaveBeenCalledWith(true);
    });

    it("role=OWNER: TaskBoardPanel initially receives ownerId equal to the first owner's id", async () => {
        const owners = [makeOwner({ id: 12 }), makeOwner({ id: 4, username: "casey.manager", role: StaffRoles.MANAGER })];
        mockUseBoardOwners.mockReturnValue(boardOwnersValue({ owners }));

        render(<TaskBoardScreen role={StaffRoles.OWNER} />);

        await waitFor(() => {
            expect(getOwnerId()).toBe("12");
        });
    });

    it("role=OWNER: clicking a non-first sidebar entry updates TaskBoardPanel's ownerId", async () => {
        const owners = [
            makeOwner({ id: 12 }),
            makeOwner({ id: 4, username: "casey.manager", role: StaffRoles.MANAGER }),
            makeOwner({ id: 9, username: "riley.manager", role: StaffRoles.MANAGER }),
        ];
        mockUseBoardOwners.mockReturnValue(boardOwnersValue({ owners }));

        render(<TaskBoardScreen role={StaffRoles.OWNER} />);

        await waitFor(() => {
            expect(getOwnerId()).toBe("12");
        });

        fireEvent.click(screen.getByTestId("staff-board-sidebar-row-9"));

        await waitFor(() => {
            expect(getOwnerId()).toBe("9");
        });
    });

    it("role=OWNER: toggling the sidebar closed then open does not change the selected ownerId", async () => {
        const owners = [makeOwner({ id: 12 }), makeOwner({ id: 4, username: "casey.manager", role: StaffRoles.MANAGER })];
        mockUseBoardOwners.mockReturnValue(boardOwnersValue({ owners }));

        render(<TaskBoardScreen role={StaffRoles.OWNER} />);

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

    it("role=OWNER: a useBoardOwners error surfaces via ErrorSnackbar and TaskBoardPanel still renders with the fallback (self) ownerId", () => {
        mockUseBoardOwners.mockReturnValue(boardOwnersValue({ owners: [], error: "HTTP 500" }));

        render(<TaskBoardScreen role={StaffRoles.OWNER} />);

        expect(screen.getByText("HTTP 500")).toBeTruthy();
        expect(getOwnerId()).toBe("");
    });
});
