import type React from "react";
import { jest, describe, it, expect, afterEach } from "@jest/globals";
import { render, screen, fireEvent, within } from "@testing-library/react";
import ViolationList from "./ViolationList";
import { makeViolation } from "../testFixtures";
import type { ViolationTO } from "../types";

function renderList(violations: ViolationTO[], extra: Partial<React.ComponentProps<typeof ViolationList>> = {}): void {
    render(<ViolationList violations={violations} emptyText="Nothing here" testIdPrefix="v" {...extra} />);
}

afterEach(() => {
    jest.restoreAllMocks();
});

describe("ViolationList", () => {
    it("shows the empty text for no violations", () => {
        renderList([]);

        expect(screen.getByText("Nothing here")).toBeTruthy();
    });

    it("renders the row identity, class, points, dates, issuer and comment", () => {
        renderList([makeViolation({ id: 5 })]);

        expect(screen.getByTestId("v-5")).toBeTruthy();
        expect(screen.getByText("4.2 — Late arrival")).toBeTruthy();
        expect(screen.getByText("Class B")).toBeTruthy();
        expect(screen.getByText("Active")).toBeTruthy();
        expect(screen.getByText("Points: -5")).toBeTruthy();
        expect(screen.getByText("Occurred 6 Oct 2026 · Discovered 7 Oct 2026")).toBeTruthy();
        expect(screen.getByText("Issued by Gina GM")).toBeTruthy();
        expect(screen.getByText("Arrived late")).toBeTruthy();
    });

    it("omits points when 0", () => {
        renderList([makeViolation({ points: 0 })]);

        expect(screen.queryByText(/Points:/)).toBeNull();
    });

    it("shows penalty hours when positive", () => {
        renderList([makeViolation({ penaltyHours: 1.5 })]);

        expect(screen.getByText("Penalty hours: 1.50 h")).toBeTruthy();
    });

    it("shows no hours text for null (pilot) or 0 penalty hours", () => {
        renderList([makeViolation({ id: 1, penaltyHours: null }), makeViolation({ id: 2, penaltyHours: 0 })]);

        expect(screen.queryByText(/Penalty hours/)).toBeNull();
    });

    it("shows the expiry countdown with singular and plural forms", () => {
        renderList([makeViolation({ id: 1, daysUntilExpiry: 1 }), makeViolation({ id: 2, daysUntilExpiry: 12 })]);

        expect(screen.getByText("Returns in 1 day")).toBeTruthy();
        expect(screen.getByText("Returns in 12 days")).toBeTruthy();
    });

    it("shows no countdown when daysUntilExpiry is null", () => {
        renderList([makeViolation({ daysUntilExpiry: null })]);

        expect(screen.queryByText(/Returns in/)).toBeNull();
    });

    it("labels status chips: Awaiting explanation, Cancelled, Expired", () => {
        renderList([
            makeViolation({ id: 1, status: "PENDING_EXPLANATION" }),
            makeViolation({ id: 2, status: "CANCELLED", cancelledByName: "Gina", cancelReason: "Mistake" }),
            makeViolation({ id: 3, status: "ACTIVE", expired: true }),
        ]);

        expect(screen.getByText("Awaiting explanation")).toBeTruthy();
        expect(screen.getByText("Cancelled")).toBeTruthy();
        expect(screen.getByText("Expired")).toBeTruthy();
        expect(screen.getByText("Cancelled by Gina: Mistake")).toBeTruthy();
    });

    it("shows the explanation text when present", () => {
        renderList([makeViolation({ employeeExplanation: "Bus broke down" })]);

        expect(screen.getByText("Employee's explanation: Bus broke down")).toBeTruthy();
    });

    describe("pending row", () => {
        const pending = makeViolation({ status: "PENDING_EXPLANATION", explanationDueAt: "2026-10-09T10:00:00" });
        const dueMs = Date.parse("2026-10-09T10:00:00+03:00");

        it("shows the due time while the window is open", () => {
            jest.spyOn(Date, "now").mockReturnValue(dueMs - 60_000);

            renderList([pending]);

            expect(screen.getByText("Explanation due 9 Oct 2026, 10:00")).toBeTruthy();
            expect(screen.queryByText("Explanation window closed — awaiting GM")).toBeNull();
        });

        it("shows the closed message after the due time", () => {
            jest.spyOn(Date, "now").mockReturnValue(dueMs + 60_000);

            renderList([pending]);

            expect(screen.getByText("Explanation window closed — awaiting GM")).toBeTruthy();
            expect(screen.queryByText(/Explanation due/)).toBeNull();
        });
    });

    describe("dispute lines", () => {
        const base = { reason: "unfair", disputedAt: "2026-10-08T09:00:00", resolvedByName: null, resolvedAt: null, resolutionNote: null };

        it("renders open, rejected and accepted", () => {
            renderList([
                makeViolation({ id: 1, dispute: { ...base, outcome: null } }),
                makeViolation({ id: 2, dispute: { ...base, outcome: "UPHELD" } }),
                makeViolation({ id: 3, dispute: { ...base, outcome: "CANCELLED" } }),
            ]);

            expect(screen.getByText("Dispute open: unfair")).toBeTruthy();
            expect(screen.getByText("Dispute rejected — violation stands")).toBeTruthy();
            expect(screen.getByText("Dispute accepted — violation cancelled")).toBeTruthy();
        });
    });

    describe("View photo", () => {
        it("is absent without onViewPhoto", () => {
            renderList([makeViolation({ hasPhoto: true })]);

            expect(screen.queryByText("View photo")).toBeNull();
        });

        it("is absent when hasPhoto is false", () => {
            renderList([makeViolation({ hasPhoto: false })], { onViewPhoto: jest.fn() });

            expect(screen.queryByText("View photo")).toBeNull();
        });

        it("calls onViewPhoto with the violation when shown", () => {
            const onViewPhoto = jest.fn<void, [ViolationTO]>();
            const v = makeViolation({ hasPhoto: true });
            renderList([v], { onViewPhoto });

            fireEvent.click(screen.getByText("View photo"));

            expect(onViewPhoto).toHaveBeenCalledWith(v);
        });
    });

    it("renders whatever renderActions returns", () => {
        renderList([makeViolation({ id: 9 })], {
            renderActions: (v) => <button type="button">act-{v.id}</button>,
        });

        expect(screen.getByText("act-9")).toBeTruthy();
    });

    it("shows 'Confirmed automatically' only for an automatically confirmed violation", () => {
        renderList([
            makeViolation({ id: 1, confirmedAutomatically: true }),
            makeViolation({ id: 2, confirmedAutomatically: false }),
        ]);

        expect(screen.getAllByText("Confirmed automatically")).toHaveLength(1);
        expect(within(screen.getByTestId("v-1")).getByText("Confirmed automatically")).toBeTruthy();
        expect(within(screen.getByTestId("v-2")).queryByText("Confirmed automatically")).toBeNull();
    });
});
