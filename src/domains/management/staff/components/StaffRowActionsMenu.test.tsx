import { jest, describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import StaffRowActionsMenu from "./StaffRowActionsMenu";
import type { StaffRowAction } from "./StaffRowActionsMenu";

function makeAction(key: string, overrides: Partial<StaffRowAction> = {}): StaffRowAction {
    return {
        key,
        label: `Label ${key}`,
        icon: <span data-testid={`icon-${key}`} />,
        onSelect: jest.fn<void, []>(),
        testId: `item-${key}`,
        ...overrides,
    };
}

describe("StaffRowActionsMenu", () => {
    it("renders nothing for an empty action list", () => {
        const { container } = render(<StaffRowActionsMenu staffId={1} actions={[]} />);

        expect(container.firstChild).toBeNull();
        expect(screen.queryByTestId("staff-row-menu-1")).toBeNull();
    });

    it("opens on trigger click and renders labels and icons in array order", () => {
        const keys = ["a", "b", "c"];
        render(<StaffRowActionsMenu staffId={7} actions={keys.map(k => makeAction(k))} />);
        expect(screen.queryByRole("menu")).toBeNull();

        fireEvent.click(screen.getByTestId("staff-row-menu-7"));

        const items = screen.getAllByRole("menuitem");
        expect(items.map(i => i.textContent)).toEqual(["Label a", "Label b", "Label c"]);
        expect(items.map(i => i.getAttribute("data-testid"))).toEqual(["item-a", "item-b", "item-c"]);
        items.forEach((item, idx) => expect(within(item).getByTestId(`icon-${keys[idx]}`)).toBeTruthy());
        expect(screen.getByTestId("staff-row-menu-7").getAttribute("aria-label")).toBe("Staff actions");
    });

    it("calls onSelect exactly once and closes the menu on item click", async () => {
        const action = makeAction("a");
        render(<StaffRowActionsMenu staffId={1} actions={[action]} />);
        fireEvent.click(screen.getByTestId("staff-row-menu-1"));

        fireEvent.click(screen.getByTestId("item-a"));

        expect(action.onSelect).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(screen.queryByTestId("item-a")).toBeNull());
    });

    it("invokes onSelect synchronously within the click event", () => {
        const order: string[] = [];
        const action = makeAction("a", { onSelect: (): void => { order.push("select"); } });
        render(<StaffRowActionsMenu staffId={1} actions={[action]} />);
        fireEvent.click(screen.getByTestId("staff-row-menu-1"));

        fireEvent.click(screen.getByTestId("item-a"));
        order.push("after-click");

        expect(order).toEqual(["select", "after-click"]);
    });

    it("does not call onSelect for a disabled item", () => {
        const action = makeAction("a", { disabled: true });
        render(<StaffRowActionsMenu staffId={1} actions={[action]} />);
        fireEvent.click(screen.getByTestId("staff-row-menu-1"));

        fireEvent.click(screen.getByTestId("item-a"));

        expect(action.onSelect).not.toHaveBeenCalled();
        expect(screen.getByTestId("item-a").getAttribute("aria-disabled")).toBe("true");
    });

    it("shows a progressbar in the trigger when busy and keeps it enabled", () => {
        render(<StaffRowActionsMenu staffId={1} actions={[makeAction("a")]} busy />);

        const trigger = screen.getByTestId("staff-row-menu-1");

        expect(within(trigger).getByRole("progressbar")).toBeTruthy();
        expect((trigger as HTMLButtonElement).disabled).toBe(false);
    });

    it("shows no progressbar when not busy", () => {
        render(<StaffRowActionsMenu staffId={1} actions={[makeAction("a")]} />);

        expect(within(screen.getByTestId("staff-row-menu-1")).queryByRole("progressbar")).toBeNull();
    });

    it("closes on Escape without calling onSelect", async () => {
        const action = makeAction("a");
        render(<StaffRowActionsMenu staffId={1} actions={[action]} />);
        fireEvent.click(screen.getByTestId("staff-row-menu-1"));

        fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });

        await waitFor(() => expect(screen.queryByTestId("item-a")).toBeNull());
        expect(action.onSelect).not.toHaveBeenCalled();
    });

    it("renders an extra appended action (Phase 9 extension guarantee)", () => {
        render(<StaffRowActionsMenu staffId={1} actions={[makeAction("a"), makeAction("discipline")]} />);

        fireEvent.click(screen.getByTestId("staff-row-menu-1"));

        expect(screen.getAllByRole("menuitem").map(i => i.textContent)).toEqual(["Label a", "Label discipline"]);
    });
});
