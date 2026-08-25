import { describe, it, expect, jest } from "@jest/globals";
import { render, screen, fireEvent } from "@testing-library/react";
// i18n instance (side-effect import) so keys resolve to English under the default language.
import "../../../shared/i18n";
import { ActiveOrderIslandPill } from "./ActiveOrderIslandPill";

describe("ActiveOrderIslandPill", () => {
    it("renders the branch name and order number", () => {
        render(
            <ActiveOrderIslandPill
                branchName="Downtown"
                orderNumber={42}
                status="Kitchen Phase"
                timeLeft={300}
                onClick={() => undefined}
            />
        );

        expect(screen.getByText("Downtown")).toBeTruthy();
        expect(screen.getByText("Order #42")).toBeTruthy();
    });

    it("shows the ETA in minutes while preparing", () => {
        render(
            <ActiveOrderIslandPill
                branchName="Downtown"
                orderNumber={7}
                status="Oven"
                timeLeft={300}
                onClick={() => undefined}
            />
        );

        // 300s -> ceil to 5 min
        expect(screen.getByText("5 min")).toBeTruthy();
    });

    // Asserts the current customerAuth `island.ready` copy. It was rewritten from "Ready!" to a
    // call to action, and this assertion was left behind -- the component was never wrong.
    it("shows the pick-up call to action instead of an ETA when the order is ready", () => {
        render(
            <ActiveOrderIslandPill
                branchName="Downtown"
                orderNumber={7}
                status="Ready"
                timeLeft={0}
                onClick={() => undefined}
            />
        );

        expect(screen.getByText("Come In And Pick Up Your Order!")).toBeTruthy();
        // The "Estimated Ready in" caption and the branch name both give way to it.
        expect(screen.queryByText("Estimated Ready in")).toBeNull();
    });

    it("calls onClick when clicked", () => {
        const onClick = jest.fn<void, []>();
        render(
            <ActiveOrderIslandPill
                branchName="Downtown"
                orderNumber={7}
                status="Kitchen Phase"
                timeLeft={60}
                onClick={onClick}
            />
        );

        fireEvent.click(screen.getByTestId("active-order-island-pill"));

        expect(onClick).toHaveBeenCalledTimes(1);
    });
});
