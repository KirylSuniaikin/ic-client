import { jest, describe, it, expect, beforeEach, beforeAll } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import DeliverySwitch from "./DeliverySwitch";
import { putDeliveryEnabled } from "../../../../shared/api/management";

jest.mock("../../../../shared/api/management");

beforeAll(() => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
});

// jest.mocked, never a `jest.Mock` annotation: there is no @types/jest in this repo, so the
// annotation form compiles under Babel and then fails tsc.
const mockPut = jest.mocked(putDeliveryEnabled);

beforeEach(() => {
    mockPut.mockReset();
    mockPut.mockResolvedValue({ branchId: "b1", deliveryEnabled: false });
});

const SWITCH = "Delivery for this branch";

// jest-dom matchers are not wired to the `expect` exported by @jest/globals in this repo (the
// rest of the suite asserts with toBeTruthy for the same reason), so read the input directly.
function switchInput(): HTMLInputElement {
    return screen.getByLabelText(SWITCH) as HTMLInputElement;
}

describe("DeliverySwitch", () => {
    it("reflects the branch's current delivery state", () => {
        render(<DeliverySwitch branchId="b1" deliveryEnabled={true} />);

        expect(switchInput().checked).toBe(true);
    });

    it("sends the new state for this branch", async () => {
        render(<DeliverySwitch branchId="b1" deliveryEnabled={true} />);

        fireEvent.click(switchInput());

        await waitFor(() => expect(mockPut).toHaveBeenCalledWith("b1", false));
    });

    /**
     * The switch is the manager's only feedback. Leaving it in the old position while the request
     * flies reads as a dead control, so it moves first — which makes the failure path the part
     * that matters: it must go back, not silently claim a change that never landed.
     */
    it("puts the switch back when the server refuses", async () => {
        mockPut.mockRejectedValue(new Error("HTTP 403"));
        render(<DeliverySwitch branchId="b1" deliveryEnabled={true} />);

        fireEvent.click(switchInput());

        expect(await screen.findByText(/Could not change delivery/)).toBeTruthy();
        await waitFor(() => expect(switchInput().checked).toBe(true));
    });

    /**
     * `deliveryEnabled` is optional on IBranch, so a branch object that did not come from a branch
     * fetch has no answer. Guessing a default would show a delivery branch as switched off (or the
     * reverse) and invite a manager to "fix" a state that was never wrong.
     */
    it("says so rather than guessing when the state is unknown", () => {
        render(<DeliverySwitch branchId="b1" deliveryEnabled={undefined} />);

        expect(switchInput().disabled).toBe(true);
        expect(screen.getByText(/was not reported/)).toBeTruthy();
    });

    /** The branch selector lives on the other tab; a switch left on the old branch's answer lies. */
    it("re-seeds when the scoped branch changes", () => {
        const { rerender } = render(<DeliverySwitch branchId="b1" deliveryEnabled={true} />);
        expect(switchInput().checked).toBe(true);

        rerender(<DeliverySwitch branchId="b2" deliveryEnabled={false} />);

        expect(switchInput().checked).toBe(false);
    });

    it("tells the parent what the server settled on", async () => {
        const onChanged = jest.fn<void, [string, boolean]>();
        render(<DeliverySwitch branchId="b1" deliveryEnabled={true} onChanged={onChanged} />);

        fireEvent.click(switchInput());

        await waitFor(() => expect(onChanged).toHaveBeenCalledWith("b1", false));
    });
});
