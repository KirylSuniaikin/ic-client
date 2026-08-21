import { describe, it, expect } from "@jest/globals";
import { computeReorder, resolveDropTarget, TaskCardNotFoundError } from "./dragOrdering";
import type { ColumnGeometry, Rect } from "./dragOrdering";
import type { TaskCard, TaskCardStatus } from "./types";

function makeCard(overrides: Partial<TaskCard> = {}): TaskCard {
    return {
        id: 1,
        title: "Restock mozzarella",
        description: null,
        priority: "GREEN",
        status: "BACKLOG",
        position: 0,
        assigneeId: 7,
        createdAt: "2026-08-12T10:00:00",
        updatedAt: "2026-08-12T10:00:00",
        deadline: null,
        hasImage: false,
        ...overrides,
    };
}

describe("computeReorder", () => {
    it("throws TaskCardNotFoundError for an unknown cardId", () => {
        const cards = [makeCard({ id: 1 })];
        expect(() => computeReorder(cards, 999, "BACKLOG", 0)).toThrow(TaskCardNotFoundError);
    });

    it("same-column reorder renumbers densely and keeps status unchanged", () => {
        const cards = [
            makeCard({ id: 1, status: "BACKLOG", position: 0 }),
            makeCard({ id: 2, status: "BACKLOG", position: 1 }),
            makeCard({ id: 3, status: "BACKLOG", position: 2 }),
        ];

        // Move card 1 to index 2 (end) within BACKLOG.
        const result = computeReorder(cards, 1, "BACKLOG", 2);
        const backlog = result.filter(c => c.status === "BACKLOG").sort((a, b) => a.position - b.position);

        expect(backlog.map(c => c.id)).toEqual([2, 3, 1]);
        expect(backlog.map(c => c.position)).toEqual([0, 1, 2]);
    });

    it("cross-column move updates status and renumbers both affected columns", () => {
        const cards = [
            makeCard({ id: 1, status: "BACKLOG", position: 0 }),
            makeCard({ id: 2, status: "BACKLOG", position: 1 }),
            makeCard({ id: 3, status: "DOING", position: 0 }),
        ];

        const result = computeReorder(cards, 1, "DOING", 0);

        const moved = result.find(c => c.id === 1);
        expect(moved?.status).toBe("DOING");
        expect(moved?.position).toBe(0);

        const doing = result.filter(c => c.status === "DOING").sort((a, b) => a.position - b.position);
        expect(doing.map(c => c.id)).toEqual([1, 3]);
        expect(doing.map(c => c.position)).toEqual([0, 1]);

        const backlog = result.filter(c => c.status === "BACKLOG").sort((a, b) => a.position - b.position);
        expect(backlog.map(c => c.id)).toEqual([2]);
        expect(backlog.map(c => c.position)).toEqual([0]);
    });

    it("unaffected cards (different status than source/target) are returned by the same object reference", () => {
        const doneCard = makeCard({ id: 9, status: "DONE", position: 0 });
        const cards = [
            makeCard({ id: 1, status: "BACKLOG", position: 0 }),
            makeCard({ id: 2, status: "DOING", position: 0 }),
            doneCard,
        ];

        const result = computeReorder(cards, 1, "DOING", 0);
        const untouched = result.find(c => c.id === 9);
        expect(untouched).toBe(doneCard);
    });

    it("clamps targetIndex when out of range on same-column reorder", () => {
        const cards = [
            makeCard({ id: 1, status: "BACKLOG", position: 0 }),
            makeCard({ id: 2, status: "BACKLOG", position: 1 }),
        ];

        const result = computeReorder(cards, 1, "BACKLOG", 999);
        const backlog = result.filter(c => c.status === "BACKLOG").sort((a, b) => a.position - b.position);
        expect(backlog.map(c => c.id)).toEqual([2, 1]);
    });

    it("clamps targetIndex when out of range on cross-column move", () => {
        const cards = [
            makeCard({ id: 1, status: "BACKLOG", position: 0 }),
            makeCard({ id: 2, status: "DOING", position: 0 }),
        ];

        const result = computeReorder(cards, 1, "DOING", -5);
        const doing = result.filter(c => c.status === "DOING").sort((a, b) => a.position - b.position);
        expect(doing.map(c => c.id)).toEqual([1, 2]);
    });
});

describe("resolveDropTarget", () => {
    function rect(top: number, bottom: number, left = 0, right = 300): Rect {
        return { top, bottom, left, right };
    }

    function backlogColumn(cardRects: { id: number; rect: Rect }[] = []): ColumnGeometry {
        return {
            status: "BACKLOG" as TaskCardStatus,
            rect: rect(0, 1000, 0, 300),
            cardRects,
        };
    }

    it("a point between two cards' midpoints returns the correct index", () => {
        const columns = [
            backlogColumn([
                { id: 1, rect: rect(0, 100) },
                { id: 2, rect: rect(100, 200) },
            ]),
        ];

        // Midpoints: card1 = 50, card2 = 150. Point at y=120 is below card1's midpoint,
        // above card2's midpoint => index 1.
        const result = resolveDropTarget(columns, { x: 10, y: 120 }, null);
        expect(result).toEqual({ status: "BACKLOG", index: 1 });
    });

    it("a point below all cards in a column returns the column's length", () => {
        const columns = [
            backlogColumn([
                { id: 1, rect: rect(0, 100) },
                { id: 2, rect: rect(100, 200) },
            ]),
        ];

        const result = resolveDropTarget(columns, { x: 10, y: 999 }, null);
        expect(result).toEqual({ status: "BACKLOG", index: 2 });
    });

    it("a point inside a column with no cards returns 0", () => {
        const columns = [backlogColumn([])];
        const result = resolveDropTarget(columns, { x: 10, y: 50 }, null);
        expect(result).toEqual({ status: "BACKLOG", index: 0 });
    });

    it("a point outside every column's rect returns null", () => {
        const columns = [backlogColumn([{ id: 1, rect: rect(0, 100) }])];
        const result = resolveDropTarget(columns, { x: 9999, y: 9999 }, null);
        expect(result).toBeNull();
    });

    it("excludes the dragged card's own rect from index counting", () => {
        const columns = [
            backlogColumn([
                { id: 1, rect: rect(0, 100) },
                { id: 2, rect: rect(100, 200) },
                { id: 3, rect: rect(200, 300) },
            ]),
        ];

        // Excluding card 2 (the one being dragged): remaining midpoints are card1=50, card3=250.
        // Point at y=260 is below both => index 2.
        const result = resolveDropTarget(columns, { x: 10, y: 260 }, 2);
        expect(result).toEqual({ status: "BACKLOG", index: 2 });
    });
});
