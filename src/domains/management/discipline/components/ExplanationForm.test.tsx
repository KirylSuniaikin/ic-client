import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { submitExplanation } from "../../../../shared/api/management";
import ExplanationForm from "./ExplanationForm";
import { makeViolation } from "../testFixtures";
import type { ViolationTO } from "../types";

jest.mock("../../../../shared/api/management");

const mockExplain = jest.mocked(submitExplanation);

beforeEach(() => {
    mockExplain.mockReset();
});

function type(text: string): void {
    fireEvent.change(screen.getByLabelText("Your explanation"), { target: { value: text } });
}

function submitButton(): HTMLButtonElement {
    return screen.getByRole("button", { name: "Submit explanation" }) as HTMLButtonElement;
}

describe("ExplanationForm", () => {
    it("shows the field and the 48-hour caption", () => {
        render(<ExplanationForm violationId={3} onDone={jest.fn()} />);

        expect(screen.getByLabelText("Your explanation")).toBeTruthy();
        expect(
            screen.getByText("You can submit one explanation within 48 hours. It cannot be changed afterwards."),
        ).toBeTruthy();
    });

    it("disables Submit while the text is blank or whitespace", () => {
        render(<ExplanationForm violationId={3} onDone={jest.fn()} />);
        expect(submitButton().disabled).toBe(true);

        type("   ");
        expect(submitButton().disabled).toBe(true);

        type("real text");
        expect(submitButton().disabled).toBe(false);
    });

    it("limits the field to 2000 characters", () => {
        render(<ExplanationForm violationId={3} onDone={jest.fn()} />);

        expect(screen.getByLabelText("Your explanation").getAttribute("maxlength")).toBe("2000");
    });

    it("submits the trimmed text and calls onDone", async () => {
        mockExplain.mockResolvedValue(makeViolation());
        const onDone = jest.fn();
        render(<ExplanationForm violationId={3} onDone={onDone} />);

        type("  I was ill  ");
        fireEvent.click(submitButton());

        await waitFor(() => expect(onDone).toHaveBeenCalled());
        expect(mockExplain).toHaveBeenCalledWith(3, { text: "I was ill" });
    });

    it("disables Submit while the request is in flight", async () => {
        mockExplain.mockReturnValue(new Promise<ViolationTO>(() => undefined));
        render(<ExplanationForm violationId={3} onDone={jest.fn()} />);

        type("text");
        fireEvent.click(submitButton());

        await waitFor(() => expect(submitButton().disabled).toBe(true));
    });

    it("shows the server message inline on rejection, keeps the form and refreshes", async () => {
        mockExplain.mockRejectedValue(new Error("Explanation window closed"));
        const onDone = jest.fn();
        render(<ExplanationForm violationId={3} onDone={onDone} />);

        type("late text");
        fireEvent.click(submitButton());

        expect((await screen.findByRole("alert")).textContent).toBe("Explanation window closed");
        expect((screen.getByLabelText("Your explanation") as HTMLTextAreaElement).value).toBe("late text");
        expect(onDone).toHaveBeenCalledTimes(1);
    });
});
