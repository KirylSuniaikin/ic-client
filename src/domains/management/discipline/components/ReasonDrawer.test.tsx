import { jest, describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ReasonDrawer from "./ReasonDrawer";

type Submit = (t: string) => Promise<void>;

function setup(onSubmit: Submit, open = true) {
    const onClose = jest.fn();
    render(
        <ReasonDrawer open={open} title="Cancel violation" fieldLabel="Reason" submitLabel="Do it" onSubmit={onSubmit} onClose={onClose} />,
    );
    return { onClose };
}

const type = (v: string): void => {
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: v } });
};

const submitButton = (): HTMLButtonElement => screen.getByRole("button", { name: "Do it" }) as HTMLButtonElement;

describe("ReasonDrawer", () => {
    it("renders the title and disables submit for empty and whitespace-only text", () => {
        setup(jest.fn<Promise<void>, [string]>());

        expect(screen.getByText("Cancel violation")).toBeTruthy();
        expect(submitButton().disabled).toBe(true);
        type("   ");
        expect(submitButton().disabled).toBe(true);
    });

    it("limits the field to 1000 characters", () => {
        setup(jest.fn<Promise<void>, [string]>());

        expect(screen.getByLabelText("Reason").getAttribute("maxlength")).toBe("1000");
    });

    it("submits the trimmed text and closes on success", async () => {
        const onSubmit = jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined);
        const { onClose } = setup(onSubmit);
        type("  because  ");

        fireEvent.click(submitButton());

        await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
        expect(onSubmit).toHaveBeenCalledWith("because");
    });

    it("shows the server message and stays open when onSubmit rejects", async () => {
        const onSubmit = jest.fn<Promise<void>, [string]>().mockRejectedValue(new Error("Already resolved"));
        const { onClose } = setup(onSubmit);
        type("x");

        fireEvent.click(submitButton());

        expect((await screen.findByRole("alert")).textContent).toBe("Already resolved");
        expect(onClose).not.toHaveBeenCalled();
    });

    it("disables submit while the request is in flight", async () => {
        const onSubmit = jest.fn<Promise<void>, [string]>().mockImplementation(() => new Promise<void>(() => undefined));
        setup(onSubmit);
        type("x");

        fireEvent.click(submitButton());

        await waitFor(() => expect(submitButton().disabled).toBe(true));
        fireEvent.click(submitButton());
        expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it("renders nothing while closed", () => {
        setup(jest.fn<Promise<void>, [string]>(), false);

        expect(screen.queryByTestId("reason-drawer")).toBeNull();
    });
});
