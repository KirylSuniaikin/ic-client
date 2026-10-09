import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { disputeViolation } from "../../../../shared/api/management";
import DisputeButton from "./DisputeButton";
import { makeViolation } from "../testFixtures";

jest.mock("../../../../shared/api/management");

const mockDispute = jest.mocked(disputeViolation);

beforeEach(() => {
    mockDispute.mockReset();
});

function expand(): void {
    fireEvent.click(screen.getByRole("button", { name: "Dispute" }));
}

describe("DisputeButton", () => {
    it("shows only the Dispute button initially", () => {
        render(<DisputeButton violationId={5} onDone={jest.fn()} />);

        expect(screen.getByRole("button", { name: "Dispute" })).toBeTruthy();
        expect(screen.queryByLabelText("Reason for dispute")).toBeNull();
    });

    it("expands to the reason field with Send dispute and Cancel; the field is limited to 1000 chars", () => {
        render(<DisputeButton violationId={5} onDone={jest.fn()} />);
        expand();

        expect(screen.getByLabelText("Reason for dispute").getAttribute("maxlength")).toBe("1000");
        expect(screen.getByRole("button", { name: "Send dispute" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
    });

    it("disables Send dispute while the reason is blank", () => {
        render(<DisputeButton violationId={5} onDone={jest.fn()} />);
        expand();
        const send = screen.getByRole("button", { name: "Send dispute" }) as HTMLButtonElement;
        expect(send.disabled).toBe(true);

        fireEvent.change(screen.getByLabelText("Reason for dispute"), { target: { value: "  " } });
        expect(send.disabled).toBe(true);
    });

    it("Cancel collapses back to the Dispute button without calling the API", () => {
        render(<DisputeButton violationId={5} onDone={jest.fn()} />);
        expand();
        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

        expect(screen.getByRole("button", { name: "Dispute" })).toBeTruthy();
        expect(mockDispute).not.toHaveBeenCalled();
    });

    it("sends the trimmed reason and calls onDone", async () => {
        mockDispute.mockResolvedValue(makeViolation());
        const onDone = jest.fn();
        render(<DisputeButton violationId={5} onDone={onDone} />);
        expand();

        fireEvent.change(screen.getByLabelText("Reason for dispute"), { target: { value: " Not me " } });
        fireEvent.click(screen.getByRole("button", { name: "Send dispute" }));

        await waitFor(() => expect(onDone).toHaveBeenCalled());
        expect(mockDispute).toHaveBeenCalledWith(5, { reason: "Not me" });
    });

    it("shows the server message inline on rejection and keeps the form open", async () => {
        mockDispute.mockRejectedValue(new Error("Violation already disputed"));
        render(<DisputeButton violationId={5} onDone={jest.fn()} />);
        expand();

        fireEvent.change(screen.getByLabelText("Reason for dispute"), { target: { value: "Not me" } });
        fireEvent.click(screen.getByRole("button", { name: "Send dispute" }));

        expect((await screen.findByRole("alert")).textContent).toBe("Violation already disputed");
        expect((screen.getByLabelText("Reason for dispute") as HTMLTextAreaElement).value).toBe("Not me");
    });
});
