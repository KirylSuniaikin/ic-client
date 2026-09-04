import { jest, describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { AssignCourierDialog } from "./AssignCourierDialog";
import type { CourierStats, UnassignedOrder } from "../types";

/**
 * Manual assignment (DELIVERY_SPEC.md §2.3, manual §02 "Manual assignment").
 *
 * This is the escape hatch for the one case the engine cannot answer: every rider was passed over,
 * or none was free. The customer has already paid, so the order is neither cancelled nor pushed to
 * Keeta — a human puts it on a specific rider. The dialog had no test of its own; only the happy
 * path through `CourierDispatcherPanel` touched it.
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
};

function renderDialog(couriers: CourierStats[], order: UnassignedOrder | null = ORDER) {
    const onAssign = jest.fn<void, [string]>();
    const onClose = jest.fn<void, []>();
    render(<AssignCourierDialog order={order} couriers={couriers} onAssign={onAssign} onClose={onClose} />);
    return { onAssign, onClose };
}

describe("AssignCourierDialog", () => {
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

    it("cannot assign until a rider is actually chosen", () => {
        const { onAssign } = renderDialog([courier({})]);

        const assign = screen.getByRole("button", { name: "Assign" });
        expect((assign as HTMLButtonElement).disabled).toBe(true);

        fireEvent.click(screen.getByRole("radio", { name: "Ali" }));

        expect((screen.getByRole("button", { name: "Assign" }) as HTMLButtonElement).disabled).toBe(false);
        fireEvent.click(screen.getByRole("button", { name: "Assign" }));
        expect(onAssign).toHaveBeenCalledWith("c1");
    });

    it("assigns the rider that is actually selected, not the first one listed", () => {
        const { onAssign } = renderDialog([
            courier({ courierId: "c1", name: "Ali" }),
            courier({ courierId: "c2", name: "Sara" }),
        ]);

        fireEvent.click(screen.getByRole("radio", { name: "Sara" }));
        fireEvent.click(screen.getByRole("button", { name: "Assign" }));

        expect(onAssign).toHaveBeenCalledWith("c2");
        expect(onAssign).toHaveBeenCalledTimes(1);
    });

    it("marks the chosen rider as chosen", () => {
        renderDialog([courier({ courierId: "c1", name: "Ali" }), courier({ courierId: "c2", name: "Sara" })]);

        fireEvent.click(screen.getByRole("radio", { name: "Sara" }));

        expect(screen.getByRole("radio", { name: "Sara" }).getAttribute("aria-checked")).toBe("true");
        expect(screen.getByRole("radio", { name: "Ali" }).getAttribute("aria-checked")).toBe("false");
    });

    /** The rows are divs, so keyboard selection has to be wired by hand — and it is. */
    it("can be driven from the keyboard, not only by tapping", () => {
        const { onAssign } = renderDialog([courier({ courierId: "c1", name: "Ali" })]);

        fireEvent.keyDown(screen.getByRole("radio", { name: "Ali" }), { key: "Enter" });
        fireEvent.click(screen.getByRole("button", { name: "Assign" }));

        expect(onAssign).toHaveBeenCalledWith("c1");
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
});
