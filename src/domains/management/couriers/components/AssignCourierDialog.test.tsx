import { jest, describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AssignCourierDialog } from "./AssignCourierDialog";
import type { CourierBoardRow, CourierStats, ManualAssignResult, UnassignedOrder } from "../types";

/**
 * Manual assignment (DELIVERY_SPEC.md §2.3, manual §02 "Manual assignment").
 *
 * This is the escape hatch for the one case the engine cannot answer: every rider was passed over,
 * or none was free. The customer has already paid, so the order is neither cancelled nor pushed to
 * Keeta — a human puts it on a specific rider. The dialog had no test of its own; only the happy
 * path through `CourierDispatcherPanel` touched it.
 *
 * It is now also what a live delivery on the board opens, carrying the engine's per-rider verdict
 * as a section — so the two optional halves (the verdict, and whether assignment is offered at
 * all) are covered here as well as through the board.
 */

function courier(overrides: Partial<CourierStats>): CourierStats {
    return {
        courierId: "c1", name: "Ali", status: "FREE",
        nearestBranchId: "b1", nearestBranchName: "Manama",
        accepted: 0, declined: 0, missed: 0, delivered: 0,
        ...overrides,
    };
}

const ORDER: UnassignedOrder = {
    orderId: 99, orderNo: 4821, status: "Ready", branchId: "b1", branchName: "Manama",
    addressLine: "Block 338, Road 3801", waitingMinutes: 14,
    pizzaCount: 3, couriersNeeded: 1, oversized: false,
    partId: 501, partIndex: 1, partsTotal: 1,
};

const RANKED: CourierBoardRow = {
    courierId: "c1", name: "Ali", phone: "39001122", status: "FREE",
    freeAt: "2026-08-08T10:04:00", rank: 0, score: 2.34, noOfferReason: null,
    declinedCount: 0, missedCount: 0, ordersInHand: 0,
    onShiftSince: null, positionFixedAt: null, positionStaleAfterMinutes: 10,
};

const PASSED_OVER: CourierBoardRow = {
    ...RANKED, courierId: "c2", name: "Sara", phone: null,
    rank: null, score: null, noOfferReason: "TOO_FAR",
};


/**
 * jsdom has no matchMedia, so MUI's useMediaQuery falls back to `false` and every test would
 * otherwise exercise the desktop shell only — the phone branch would ship untested.
 */
function setNarrowViewport(matches: boolean): void {
    Object.defineProperty(window, "matchMedia", {
        writable: true,
        configurable: true,
        value: (query: string) => ({
            matches,
            media: query,
            onchange: null,
            addListener: (): void => {},
            removeListener: (): void => {},
            addEventListener: (): void => {},
            removeEventListener: (): void => {},
            dispatchEvent: (): boolean => false,
        }),
    });
}

function renderDialog(
    couriers: CourierStats[],
    order: UnassignedOrder | null = ORDER,
    extra: Partial<React.ComponentProps<typeof AssignCourierDialog>> = {}
) {
    const onAssign = jest.fn<Promise<ManualAssignResult>, [string, boolean]>();
    onAssign.mockResolvedValue({ assigned: true, warning: null });
    const onClose = jest.fn<void, []>();
    render(
        <AssignCourierDialog
            order={order}
            couriers={couriers}
            onAssign={onAssign}
            onClose={onClose}
            {...extra}
        />
    );
    return { onAssign, onClose };
}

describe("AssignCourierDialog", () => {
    /**
     * A centred modal is the wrong shape on a phone — it lands mid-screen with its actions away
     * from the thumb — so below `sm` this is a bottom sheet, like every other sheet in the app.
     * One body, two shells.
     */
    it("is a bottom sheet on a phone and a dialog on a desktop", () => {
        // Arrange / Act — phone.
        setNarrowViewport(true);
        const phone = render(
            <AssignCourierDialog order={ORDER} couriers={[courier({}), courier({ courierId: "c2", name: "Sara" })]} onAssign={jest.fn()} onClose={jest.fn()} />
        );

        // Assert
        expect(document.querySelector(".MuiDrawer-root")).not.toBeNull();
        expect(document.querySelector(".MuiDialog-root")).toBeNull();
        phone.unmount();

        // Arrange / Act — desktop.
        setNarrowViewport(false);
        renderDialog([courier({}), courier({ courierId: "c2", name: "Sara" })]);

        // Assert
        expect(document.querySelector(".MuiDialog-root")).not.toBeNull();
        expect(document.querySelector(".MuiDrawer-root")).toBeNull();
    });

    /**
     * The bug this pins: on a phone, tapping a board card did nothing at all.
     *
     * The whole dispatcher panel is itself a fullScreen MUI `Dialog`, and MUI gives a temporary
     * `Drawer` `zIndex.drawer` (1200) while a `Dialog` gets `zIndex.modal` (1300). Nested, the
     * sheet opened *behind* the panel that opened it — no error, nothing in the console, and the
     * card simply appearing dead to the touch. The desktop branch was never affected because a
     * Dialog inside a Dialog shares 1300 and wins on DOM order, which is exactly why this went
     * unnoticed: every test and every developer machine was on the branch that worked.
     */
    it("stacks the phone sheet above the panel that opened it", () => {
        setNarrowViewport(true);

        renderDialog([courier({})]);

        const drawer = document.querySelector(".MuiDrawer-root");
        const zIndex = Number(window.getComputedStyle(drawer as Element).zIndex);
        // 1300 is MUI's zIndex.modal, the layer the surrounding fullScreen Dialog sits on.
        expect(zIndex).toBeGreaterThan(1300);
    });

    /** The sheet still has to do the job: the same actions, reachable. */
    it("still assigns from the phone sheet", async () => {
        setNarrowViewport(true);
        const { onAssign } = renderDialog([courier({}), courier({ courierId: "c2", name: "Sara" })]);

        fireEvent.click(screen.getByText("Sara"));
        fireEvent.click(screen.getByRole("button", { name: "Assign" }));

        await waitFor(() => expect(onAssign).toHaveBeenCalledWith("c2", false));
    });

    it("names the order and where it is going, so the manager is not assigning a number", () => {
        renderDialog([courier({})]);

        expect(screen.getByText(/Assign order #4821/)).toBeTruthy();
        expect(screen.getByText(/Block 338, Road 3801 — from Manama/)).toBeTruthy();
    });

    /**
     * `manualAssign` answers 409 for both OFFLINE and BLACKLISTED. Offering either would be a
     * button that fails, on the screen a manager reaches only because everything else already
     * failed.
     */
    it("does not offer a rider the server would refuse", () => {
        renderDialog([
            courier({ courierId: "c1", name: "Ali", status: "FREE" }),
            courier({ courierId: "c2", name: "Sara", status: "OFFLINE" }),
            courier({ courierId: "c3", name: "Omar", status: "BLACKLISTED" }),
        ]);

        expect(screen.getByRole("radio", { name: "Ali" })).toBeTruthy();
        expect(screen.queryByRole("radio", { name: "Sara" })).toBeNull();
        expect(screen.queryByRole("radio", { name: "Omar" })).toBeNull();
    });

    /**
     * BUSY is deliberately selectable. §2.3 is reached only once the automatic queue has failed,
     * and a manager looking at the board may well decide the rider two streets away should take a
     * second drop — that judgement is the entire point of the manual path.
     */
    it("still offers a busy rider, because that judgement is the manager's to make", () => {
        renderDialog([courier({ courierId: "c2", name: "Sara", status: "BUSY" })]);

        expect(screen.getByRole("radio", { name: "Sara" })).toBeTruthy();
    });

    it("cannot assign until a rider is actually chosen", async () => {
        const { onAssign } = renderDialog([courier({})]);

        const assign = screen.getByRole("button", { name: "Assign" });
        expect((assign as HTMLButtonElement).disabled).toBe(true);

        fireEvent.click(screen.getByRole("radio", { name: "Ali" }));

        expect((screen.getByRole("button", { name: "Assign" }) as HTMLButtonElement).disabled).toBe(false);
        fireEvent.click(screen.getByRole("button", { name: "Assign" }));
        await waitFor(() => expect(onAssign).toHaveBeenCalledWith("c1", false));
    });

    it("assigns the rider that is actually selected, not the first one listed", async () => {
        const { onAssign } = renderDialog([
            courier({ courierId: "c1", name: "Ali" }),
            courier({ courierId: "c2", name: "Sara" }),
        ]);

        fireEvent.click(screen.getByRole("radio", { name: "Sara" }));
        fireEvent.click(screen.getByRole("button", { name: "Assign" }));

        await waitFor(() => expect(onAssign).toHaveBeenCalledWith("c2", false));
        expect(onAssign).toHaveBeenCalledTimes(1);
    });

    it("marks the chosen rider as chosen", () => {
        renderDialog([courier({ courierId: "c1", name: "Ali" }), courier({ courierId: "c2", name: "Sara" })]);

        fireEvent.click(screen.getByRole("radio", { name: "Sara" }));

        expect(screen.getByRole("radio", { name: "Sara" }).getAttribute("aria-checked")).toBe("true");
        expect(screen.getByRole("radio", { name: "Ali" }).getAttribute("aria-checked")).toBe("false");
    });

    /** The rows are divs, so keyboard selection has to be wired by hand — and it is. */
    it("can be driven from the keyboard, not only by tapping", async () => {
        const { onAssign } = renderDialog([courier({ courierId: "c1", name: "Ali" })]);

        fireEvent.keyDown(screen.getByRole("radio", { name: "Ali" }), { key: "Enter" });
        fireEvent.click(screen.getByRole("button", { name: "Assign" }));

        await waitFor(() => expect(onAssign).toHaveBeenCalledWith("c1", false));
    });

    /**
     * Nobody on shift is not an error — it is the reason the order is sitting in the queue in the
     * first place. An empty box would leave the manager wondering whether the list failed to load.
     */
    it("says nobody is on shift rather than showing an empty box", () => {
        renderDialog([courier({ status: "OFFLINE" })]);

        expect(screen.getByText(/No courier is on shift right now/)).toBeTruthy();
        expect((screen.getByRole("button", { name: "Assign" }) as HTMLButtonElement).disabled).toBe(true);
    });

    it("says so when the order has no address on file", () => {
        renderDialog([courier({})], { ...ORDER, addressLine: null, branchName: null });

        expect(screen.getByText("No address on file")).toBeTruthy();
    });

    it("falls back to the internal id when the order has no customer-facing number", () => {
        renderDialog([courier({})], { ...ORDER, orderNo: null });

        expect(screen.getByText(/Assign order #99/)).toBeTruthy();
    });

    it("stays shut while no order is being assigned", () => {
        renderDialog([courier({})], null);

        expect(screen.queryByRole("button", { name: "Assign" })).toBeNull();
    });

    it("closes without assigning anyone", () => {
        const { onAssign, onClose } = renderDialog([courier({})]);

        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onAssign).not.toHaveBeenCalled();
    });

    /**
     * The waiting-for-a-courier queue has no annotated roster to show — the section is omitted
     * entirely rather than rendered empty, because "no couriers on the roster" would be a claim
     * this call site never asked the server for.
     */
    it("shows no verdict section where nothing was passed", () => {
        renderDialog([courier({})]);

        expect(screen.getByRole("radio", { name: "Ali" })).toBeTruthy();
        expect(screen.queryByText("Why this order is with this rider and not another")).toBeNull();
        expect(screen.queryByText("No couriers on the roster.")).toBeNull();
    });

    /** The board's call site: the engine's own reasons, beside the picker, for the same order. */
    it("carries the engine's verdict beside the picker when it is given one", () => {
        renderDialog([courier({})], ORDER, { availability: [RANKED, PASSED_OVER] });

        expect(screen.getByText("Why this order is with this rider and not another")).toBeTruthy();
        expect(screen.getByText("#1 · score 2.3")).toBeTruthy();
        expect(screen.getByText("Too far from the kitchen")).toBeTruthy();
        expect(screen.getByRole("radio", { name: "Ali" })).toBeTruthy();
    });

    /**
     * `claimForCourier` only matches an order nobody holds, so assignment on an order already in a
     * rider's hands can do nothing but 409.
     */
    it("withholds the picker on an order a rider already holds, and says what to do instead", () => {
        renderDialog([courier({})], ORDER, { availability: [RANKED], assignable: false });

        expect(screen.getByText(/Release it from that courier's own list first/)).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Assign" })).toBeNull();
        expect(screen.queryByRole("radio", { name: "Ali" })).toBeNull();
        expect(screen.getByText(/^Order #4821$/)).toBeTruthy();
    });

    /**
     * The verdict answers "which rider should take this", and that question is settled the moment
     * one has. On a delivery already in flight it was the first thing in the popup and the order
     * itself was a single grey line — so a dispatcher who opened a card to ring the customer got a
     * ranking table instead of a phone number.
     */
    it("drops the engine's ranking once a rider holds the order", () => {
        renderDialog([courier({})], ORDER, { availability: [RANKED], assignable: false });

        expect(screen.queryByText("#1 · score 2.3")).toBeNull();
        expect(
            screen.queryByText(/Why this order is with this rider and not another/)
        ).toBeNull();
    });

    /** And keeps it exactly where it is the point of the screen. */
    it("keeps the engine's ranking while the order is still being handed out", () => {
        renderDialog([courier({})], ORDER, { availability: [RANKED], assignable: true });

        expect(screen.getByText("#1 · score 2.3")).toBeTruthy();
    });
});

/**
 * Server-authoritative two-step (courier-capacity, task-spec.md §5 "Resolved design decision"):
 * pressing Assign always sends `acknowledgeOverCapacity: false` first. `assigned: false` means the
 * server refused and changed nothing — the dialog has to show the warning and relabel its own
 * button rather than close, and the next press has to acknowledge. This is the manager's whole
 * escape hatch for an order too big for one rider, so it must never dead-end.
 */
describe("AssignCourierDialog — the over-capacity warning", () => {
    const WARNING = { riderPizzas: 6, orderPizzas: 4, totalPizzas: 10, capacity: 8 };

    function renderWithSequence(results: ManualAssignResult[]) {
        const onAssign = jest.fn<Promise<ManualAssignResult>, [string, boolean]>();
        for (const result of results) onAssign.mockResolvedValueOnce(result);
        render(
            <AssignCourierDialog
                order={ORDER}
                couriers={[courier({})]}
                onAssign={onAssign}
                onClose={jest.fn()}
            />
        );
        return { onAssign };
    }

    it("sends the first press unacknowledged", async () => {
        const { onAssign } = renderWithSequence([{ assigned: true, warning: null }]);

        fireEvent.click(screen.getByRole("radio", { name: "Ali" }));
        fireEvent.click(screen.getByRole("button", { name: "Assign" }));

        await waitFor(() => expect(onAssign).toHaveBeenCalledWith("c1", false));
    });

    it("shows the warning and relabels the button when the server refuses over capacity", async () => {
        renderWithSequence([{ assigned: false, warning: WARNING }]);

        fireEvent.click(screen.getByRole("radio", { name: "Ali" }));
        fireEvent.click(screen.getByRole("button", { name: "Assign" }));

        expect(await screen.findByRole("button", { name: "Assign anyway" })).toBeTruthy();
        // The four numbers a manager is deciding against — rider load, this order, the total, the
        // configured capacity — not just a generic "over capacity" sentence.
        expect(screen.getByText(/already carrying 6 pizzas/)).toBeTruthy();
        expect(screen.getByText(/adds 4 more/)).toBeTruthy();
        expect(screen.getByText(/10 total/)).toBeTruthy();
        expect(screen.getByText(/8-pizza limit/)).toBeTruthy();
    });

    /** Requirement 18: the selected rider must not be cleared by the refusal. */
    it("keeps the chosen rider selected after the server refuses", async () => {
        renderWithSequence([{ assigned: false, warning: WARNING }]);

        fireEvent.click(screen.getByRole("radio", { name: "Ali" }));
        fireEvent.click(screen.getByRole("button", { name: "Assign" }));

        await screen.findByRole("button", { name: "Assign anyway" });
        expect(screen.getByRole("radio", { name: "Ali" }).getAttribute("aria-checked")).toBe("true");
    });

    /**
     * Issue 3 (review iteration 1): an acknowledgement is only valid for the request whose warning
     * is on screen. Selecting a different rider after a refusal is a DIFFERENT request — one whose
     * load was never computed or shown — so it must not silently inherit the previous rider's
     * "Assign anyway" acknowledgement.
     */
    it("clears a stale warning when a different rider is selected after a refusal", async () => {
        const onAssign = jest.fn<Promise<ManualAssignResult>, [string, boolean]>();
        onAssign.mockResolvedValueOnce({ assigned: false, warning: WARNING });
        onAssign.mockResolvedValueOnce({ assigned: true, warning: null });
        render(
            <AssignCourierDialog
                order={ORDER}
                couriers={[courier({ courierId: "c1", name: "Ali" }), courier({ courierId: "c2", name: "Sara" })]}
                onAssign={onAssign}
                onClose={jest.fn()}
            />
        );

        fireEvent.click(screen.getByRole("radio", { name: "Ali" }));
        fireEvent.click(screen.getByRole("button", { name: "Assign" }));
        await screen.findByRole("button", { name: "Assign anyway" });

        fireEvent.click(screen.getByRole("radio", { name: "Sara" }));

        expect(screen.queryByRole("button", { name: "Assign anyway" })).toBeNull();
        expect(screen.getByRole("button", { name: "Assign" })).toBeTruthy();
        expect(screen.queryByText(/already carrying/)).toBeNull();
        expect(screen.getByRole("radio", { name: "Sara" }).getAttribute("aria-checked")).toBe("true");

        fireEvent.click(screen.getByRole("button", { name: "Assign" }));

        await waitFor(() => expect(onAssign).toHaveBeenNthCalledWith(2, "c2", false));
    });

    /** Re-selecting the SAME rider after a refusal must not wipe out the warning still on screen. */
    it("keeps the warning when the same rider is re-selected", async () => {
        renderWithSequence([{ assigned: false, warning: WARNING }]);

        fireEvent.click(screen.getByRole("radio", { name: "Ali" }));
        fireEvent.click(screen.getByRole("button", { name: "Assign" }));
        await screen.findByRole("button", { name: "Assign anyway" });

        fireEvent.click(screen.getByRole("radio", { name: "Ali" }));

        expect(screen.getByRole("button", { name: "Assign anyway" })).toBeTruthy();
        expect(screen.getByText(/already carrying 6 pizza/)).toBeTruthy();
    });

    it("re-sends acknowledged once the manager presses Assign anyway", async () => {
        const { onAssign } = renderWithSequence([
            { assigned: false, warning: WARNING },
            { assigned: true, warning: WARNING },
        ]);

        fireEvent.click(screen.getByRole("radio", { name: "Ali" }));
        fireEvent.click(screen.getByRole("button", { name: "Assign" }));
        fireEvent.click(await screen.findByRole("button", { name: "Assign anyway" }));

        await waitFor(() => expect(onAssign).toHaveBeenNthCalledWith(2, "c1", true));
    });

    /** No warning at all on the ordinary, within-capacity path — nothing to show, nothing to relabel. */
    it("never shows the warning or relabels the button when the order is within capacity", async () => {
        renderWithSequence([{ assigned: true, warning: null }]);

        fireEvent.click(screen.getByRole("radio", { name: "Ali" }));
        fireEvent.click(screen.getByRole("button", { name: "Assign" }));

        await waitFor(() => expect(screen.queryByRole("button", { name: "Assign anyway" })).toBeNull());
        expect(screen.queryByText(/already carrying/)).toBeNull();
    });

    /**
     * Requirement 18: "The dialog is never disabled and never blocks." The order's own `oversized`
     * flag (surfaced as the queue badge) must not gate the button — capacity is only ever learned
     * from the server's response to a real press, never guessed client-side ahead of one. Selecting
     * a rider on an oversized order has to enable Assign exactly as it does on a normal one.
     */
    it("does not disable Assign for an oversized order before any press has been made", () => {
        const oversizedOrder = { ...ORDER, pizzaCount: 17, couriersNeeded: 3, oversized: true };
        renderDialog([courier({})], oversizedOrder);

        expect((screen.getByRole("button", { name: "Assign" }) as HTMLButtonElement).disabled).toBe(true);

        fireEvent.click(screen.getByRole("radio", { name: "Ali" }));

        expect((screen.getByRole("button", { name: "Assign" }) as HTMLButtonElement).disabled).toBe(false);
    });
});

/**
 * Courier-capacity Phase 5 (task-spec.md §11 P5): the title reflects "part k of N" when the
 * target carries a partsTotal > 1 — the queue's own per-part row.
 */
describe("AssignCourierDialog — split target title", () => {
    it("reflects 'part k of N' when the target is one part of a split order", () => {
        const splitTarget: UnassignedOrder = { ...ORDER, partIndex: 2, partsTotal: 3 };
        renderDialog([courier({})], splitTarget);

        expect(screen.getByText(/part 2 of 3/)).toBeTruthy();
    });

    it("leaves the title unchanged for a plain, non-split target", () => {
        renderDialog([courier({})], ORDER);

        expect(screen.queryByText(/part \d+ of \d+/)).toBeNull();
        expect(screen.getByText(`Assign order #${ORDER.orderNo}`)).toBeTruthy();
    });
});
