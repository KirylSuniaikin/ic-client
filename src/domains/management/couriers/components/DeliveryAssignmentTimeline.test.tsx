import { jest, describe, it, expect, beforeAll, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";

import { DeliveryAssignmentTimeline, describeAction, describeActor } from "./DeliveryAssignmentTimeline";
import { fetchOrderAssignmentAudit } from "../../../../shared/api/dispatcher";
import type { DeliveryAssignmentAudit, DeliveryAssignmentAuditEntry } from "../types";

jest.mock("../../../../shared/api/dispatcher");

// jest.mocked, never a `jest.Mock` annotation — there is no @types/jest here.
const mockAudit = jest.mocked(fetchOrderAssignmentAudit);

beforeAll(() => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
});

function entry(overrides: Partial<DeliveryAssignmentAuditEntry>): DeliveryAssignmentAuditEntry {
    return {
        id: 1,
        occurredAt: "2026-10-06T19:02:11",
        action: "ASSIGNED",
        cause: "OFFER_ACCEPTED",
        actorType: "COURIER",
        actorStaffId: 17,
        actorName: "ali",
        courierId: "c-ali",
        courierName: "ali",
        partId: 55,
        partIndex: 1,
        partsTotal: 1,
        fromOrderStatus: "Kitchen Phase",
        fromStage: "AWAITING_COURIER",
        ...overrides,
    };
}

function audit(entries: DeliveryAssignmentAuditEntry[], overrides: Partial<DeliveryAssignmentAudit> = {}): DeliveryAssignmentAudit {
    return {
        orderId: 1234,
        orderCreatedAt: "2026-10-06T19:00:02",
        dataSince: "2026-10-06T15:00:00",
        entries,
        ...overrides,
    };
}

beforeEach(() => {
    // resetMocks is on, so an implementation set at module scope would already be gone.
    mockAudit.mockReset();
});

describe("DeliveryAssignmentTimeline — wording", () => {
    it("names who an order was assigned to", () => {
        expect(describeAction(entry({}), null)).toBe("Assigned to ali");
    });

    /**
     * The server has no atomic reassign: a handover between two riders is an UNASSIGNED then an
     * ASSIGNED on the same part. Read as two unrelated events it hides that a rider was swapped.
     */
    it("calls an assignment that follows an unassignment on the same part a reassignment", () => {
        const released = entry({ id: 1, action: "UNASSIGNED", cause: "MANUAL_RELEASE" });
        const next = entry({ id: 2, courierName: "sami" });

        expect(describeAction(next, released)).toBe("Reassigned to sami");
    });

    it("does not call an assignment after a return a reassignment", () => {
        const returned = entry({ id: 1, action: "RETURNED_UNDELIVERED", cause: "RETURNED_BY_COURIER" });

        expect(describeAction(entry({ id: 2 }), returned)).toBe("Assigned to ali");
    });

    it("words every action", () => {
        expect(describeAction(entry({ action: "UNASSIGNED", cause: "MANUAL_RELEASE" }), null)).toBe("Unassigned from ali");
        expect(describeAction(entry({ action: "RETURNED_UNDELIVERED", cause: "RETURNED_BY_COURIER" }), null))
            .toBe("Returned undelivered");
        expect(describeAction(entry({ action: "CANCELLED", cause: "MANUAL_CANCEL", partId: null }), null)).toBe("Cancelled");
    });

    it("says so when the rider's name is gone, rather than printing nothing", () => {
        expect(describeAction(entry({ courierName: null }), null)).toBe("Assigned to an unknown rider");
    });

    /** Person or engine is the first thing a dispatcher wants to know about any change. */
    it("words every kind of actor", () => {
        expect(describeActor(entry({ actorType: "STAFF", actorName: "manager1" }))).toBe("by manager1");
        expect(describeActor(entry({ actorType: "COURIER", actorName: "ali" }))).toBe("by ali (rider)");
        expect(describeActor(entry({ actorType: "SYSTEM", actorName: null, actorStaffId: null }))).toBe("automatically");
    });

    it("names a staff actor whose row is gone as such, not as the engine", () => {
        expect(describeActor(entry({ actorType: "STAFF", actorName: null })))
            .toBe("by a staff member no longer on the roster");
    });
});

describe("DeliveryAssignmentTimeline", () => {
    it("asks for the history of the order it was given", async () => {
        mockAudit.mockResolvedValue(audit([]));

        render(<DeliveryAssignmentTimeline orderId={1234} />);

        await waitFor(() => expect(mockAudit).toHaveBeenCalledWith(1234));
    });

    it("renders each change with its time, action, actor, cause and the state it came from", async () => {
        mockAudit.mockResolvedValue(audit([
            entry({ id: 1 }),
            entry({
                id: 2, occurredAt: "2026-10-06T19:10:00", action: "UNASSIGNED", cause: "MANUAL_RELEASE",
                actorType: "STAFF", actorName: "manager1", actorStaffId: 3, fromStage: "GOING_TO_KITCHEN",
            }),
            entry({
                id: 3, occurredAt: "2026-10-06T19:11:30", cause: "MANUAL_ASSIGN", actorType: "STAFF",
                actorName: "manager1", actorStaffId: 3, courierId: "c-sami", courierName: "sami",
            }),
            entry({
                id: 4, occurredAt: "2026-10-06T19:30:00", action: "RETURNED_UNDELIVERED",
                cause: "RETURNED_BY_COURIER", actorName: "sami", courierName: "sami", fromStage: "ON_THE_ROAD",
            }),
            entry({
                id: 5, occurredAt: "2026-10-06T19:31:00", action: "CANCELLED", cause: "MANUAL_CANCEL",
                actorType: "STAFF", actorName: "manager1", partId: null, partIndex: null, partsTotal: null,
                fromStage: "ON_THE_ROAD",
            }),
            entry({
                id: 6, occurredAt: "2026-10-06T19:32:00", action: "UNASSIGNED",
                cause: "RESERVATION_DROPPED_AT_READY", actorType: "SYSTEM", actorName: null,
                actorStaffId: null, fromStage: "GOING_TO_KITCHEN",
            }),
        ]));

        render(<DeliveryAssignmentTimeline orderId={1234} />);

        expect((await screen.findByTestId("assignment-entry-1-action")).textContent).toBe("Assigned to ali");
        expect(screen.getByTestId("assignment-entry-1").textContent).toContain("19:02");
        expect(screen.getByTestId("assignment-entry-1-detail").textContent).toBe("by ali (rider) · Accepted the offer");
        expect(screen.getByTestId("assignment-entry-1-stage").textContent).toBe("was Awaiting courier");

        expect(screen.getByTestId("assignment-entry-2-action").textContent).toBe("Unassigned from ali");
        expect(screen.getByTestId("assignment-entry-2-detail").textContent).toBe("by manager1 · Released by hand");

        expect(screen.getByTestId("assignment-entry-3-action").textContent).toBe("Reassigned to sami");
        expect(screen.getByTestId("assignment-entry-3-detail").textContent).toBe("by manager1 · Manual assignment");

        expect(screen.getByTestId("assignment-entry-4-action").textContent).toBe("Returned undelivered");
        expect(screen.getByTestId("assignment-entry-4-detail").textContent)
            .toBe("by sami (rider) · Rider brought it back");
        expect(screen.getByTestId("assignment-entry-4-stage").textContent).toBe("was On the road");

        expect(screen.getByTestId("assignment-entry-5-action").textContent).toBe("Cancelled");
        expect(screen.getByTestId("assignment-entry-5-detail").textContent).toBe("by manager1 · Cancelled by hand");

        expect(screen.getByTestId("assignment-entry-6-detail").textContent)
            .toBe("automatically · Reservation dropped at Ready");
    });

    it("prefixes the part on a split order", async () => {
        mockAudit.mockResolvedValue(audit([entry({ id: 7, partIndex: 2, partsTotal: 3 })]));

        render(<DeliveryAssignmentTimeline orderId={1234} />);

        expect((await screen.findByTestId("assignment-entry-7-action")).textContent).toBe("Part 2/3 · Assigned to ali");
    });

    /** Reassign detection is per part: part 2 being assigned is not a reassignment of part 1. */
    it("does not pair changes across different parts", async () => {
        mockAudit.mockResolvedValue(audit([
            entry({ id: 1, action: "UNASSIGNED", cause: "MANUAL_RELEASE", partId: 55, partIndex: 1, partsTotal: 2 }),
            entry({ id: 2, partId: 56, partIndex: 2, partsTotal: 2, courierName: "sami" }),
        ]));

        render(<DeliveryAssignmentTimeline orderId={1234} />);

        expect((await screen.findByTestId("assignment-entry-2-action")).textContent).toBe("Part 2/2 · Assigned to sami");
    });

    it("says so when nothing was recorded", async () => {
        mockAudit.mockResolvedValue(audit([], { orderCreatedAt: "2026-10-06T19:00:02" }));

        render(<DeliveryAssignmentTimeline orderId={1234} />);

        expect(await screen.findByText("No assignment changes recorded")).toBeTruthy();
        expect(screen.queryByTestId("assignment-timeline-since")).toBeNull();
    });

    /** An order placed before recording began can have a history that starts mid-way; say so. */
    it("says when recording began for an order older than the trail", async () => {
        mockAudit.mockResolvedValue(audit([], { orderCreatedAt: "2026-10-05T21:00:00" }));

        render(<DeliveryAssignmentTimeline orderId={1234} />);

        expect((await screen.findByTestId("assignment-timeline-since")).textContent)
            .toBe("History recorded from 6 Oct 2026, 15:00");
        expect(screen.getByText("No assignment changes recorded")).toBeTruthy();
    });

    it("shows a failure instead of an empty history when the request fails", async () => {
        mockAudit.mockRejectedValue(new Error("Response: 500"));

        render(<DeliveryAssignmentTimeline orderId={1234} />);

        expect(await screen.findByText("Could not load the assignment history.")).toBeTruthy();
        expect(screen.queryByText("No assignment changes recorded")).toBeNull();
    });

    it("loads the new order's history when pointed at another order", async () => {
        mockAudit.mockResolvedValueOnce(audit([entry({ id: 1 })]))
            .mockResolvedValueOnce(audit([entry({ id: 9, courierName: "sami" })], { orderId: 99 }));
        const { rerender } = render(<DeliveryAssignmentTimeline orderId={1234} />);
        await screen.findByTestId("assignment-entry-1");

        rerender(<DeliveryAssignmentTimeline orderId={99} />);

        expect((await screen.findByTestId("assignment-entry-9-action")).textContent).toBe("Assigned to sami");
        expect(screen.queryByTestId("assignment-entry-1")).toBeNull();
        expect(mockAudit).toHaveBeenLastCalledWith(99);
    });
});
