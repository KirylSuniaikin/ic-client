import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { cancelViolation, confirmViolation, rejectDispute } from "../../../../shared/api/management";
import type { DisputeTO, ViolationTO } from "../types";
import { makeViolation } from "../testFixtures";
import PendingReviewPanel from "./PendingReviewPanel";

jest.mock("../../../../shared/api/management");

const mConfirm = jest.mocked(confirmViolation);
const mCancel = jest.mocked(cancelViolation);
const mReject = jest.mocked(rejectDispute);

const NOW = new Date("2026-10-08T12:00:00+03:00").getTime();
const HINT = "Confirm is available once the employee has explained or the 48 hours have passed";

const openWindow: Partial<ViolationTO> = { explanationDueAt: "2026-10-09T12:00:00" };
const closedWindow: Partial<ViolationTO> = { explanationDueAt: "2026-10-07T12:00:00" };

function pending(overrides: Partial<ViolationTO> = {}): ViolationTO {
    return makeViolation({ id: 1, status: "PENDING_EXPLANATION", ...openWindow, ...overrides });
}
function dispute(overrides: Partial<DisputeTO> = {}): DisputeTO {
    return {
        reason: "I was ill", disputedAt: "2026-10-07T12:00:00", outcome: null,
        resolvedByName: null, resolvedAt: null, resolutionNote: null, ...overrides,
    };
}
const confirmButton = (): HTMLButtonElement => screen.getByRole("button", { name: "Confirm" }) as HTMLButtonElement;

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, "now").mockReturnValue(NOW);
});
afterEach(() => {
    jest.restoreAllMocks();
});

describe("PendingReviewPanel", () => {
    it("renders neither section when empty", () => {
        render(<PendingReviewPanel violations={[]} onChanged={jest.fn()} />);

        expect(screen.queryByText("Awaiting review")).toBeNull();
        expect(screen.queryByText("Open disputes")).toBeNull();
    });

    it("lists pending violations under Awaiting review and ignores plain active ones", () => {
        render(<PendingReviewPanel violations={[pending(), makeViolation({ id: 2, status: "ACTIVE" })]} onChanged={jest.fn()} />);

        expect(screen.getByText("Awaiting review")).toBeTruthy();
        expect(screen.getAllByTestId(/discipline-pending/)).toHaveLength(1);
        expect(screen.queryByText("Open disputes")).toBeNull();
    });

    it("shows 'No explanation submitted yet' without an explanation and the text with one", () => {
        const { rerender } = render(<PendingReviewPanel violations={[pending()]} onChanged={jest.fn()} />);
        expect(screen.getByText("No explanation submitted yet")).toBeTruthy();

        rerender(
            <PendingReviewPanel
                violations={[pending({ employeeExplanation: "Traffic jam", explainedAt: "2026-10-08T08:00:00" })]}
                onChanged={jest.fn()}
            />,
        );

        expect(screen.queryByText("No explanation submitted yet")).toBeNull();
        expect(screen.getByText(/Traffic jam/)).toBeTruthy();
    });

    it("disables Confirm when unexplained and the window is open, with the explanatory tooltip", async () => {
        render(<PendingReviewPanel violations={[pending()]} onChanged={jest.fn()} />);

        expect(confirmButton().disabled).toBe(true);
        fireEvent.mouseOver(confirmButton().parentElement as HTMLElement); // the Tooltip anchors on the wrapping span
        expect(await screen.findByText(HINT)).toBeTruthy();
    });

    it("enables Confirm once explainedAt is set", () => {
        render(
            <PendingReviewPanel
                violations={[pending({ explainedAt: "2026-10-08T08:00:00", employeeExplanation: "x" })]}
                onChanged={jest.fn()}
            />,
        );

        expect(confirmButton().disabled).toBe(false);
    });

    it("enables Confirm when the 48h window has closed", () => {
        render(<PendingReviewPanel violations={[pending(closedWindow)]} onChanged={jest.fn()} />);

        expect(confirmButton().disabled).toBe(false);
    });

    it("Confirm calls confirmViolation once, then onChanged", async () => {
        mConfirm.mockResolvedValue(makeViolation());
        const onChanged = jest.fn();
        render(<PendingReviewPanel violations={[pending(closedWindow)]} onChanged={onChanged} />);

        fireEvent.click(confirmButton());

        await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
        expect(mConfirm).toHaveBeenCalledTimes(1);
        expect(mConfirm).toHaveBeenCalledWith(1);
    });

    it("a rejected Confirm shows the server message and does not call onChanged", async () => {
        mConfirm.mockRejectedValue(new Error("Explanation window is still open"));
        const onChanged = jest.fn();
        render(<PendingReviewPanel violations={[pending(closedWindow)]} onChanged={onChanged} />);

        fireEvent.click(confirmButton());

        expect(await screen.findByText("Explanation window is still open")).toBeTruthy();
        expect(onChanged).not.toHaveBeenCalled();
    });

    it("disables the row's buttons while Confirm is in flight", async () => {
        mConfirm.mockImplementation(() => new Promise<ViolationTO>(() => undefined));
        render(<PendingReviewPanel violations={[pending(closedWindow)]} onChanged={jest.fn()} />);

        fireEvent.click(confirmButton());

        await waitFor(() => expect(confirmButton().disabled).toBe(true));
        expect((screen.getByRole("button", { name: "Cancel violation" }) as HTMLButtonElement).disabled).toBe(true);
    });

    it("Cancel violation requires text, sends the trimmed reason and calls onChanged", async () => {
        mCancel.mockResolvedValue(makeViolation());
        const onChanged = jest.fn();
        render(<PendingReviewPanel violations={[pending()]} onChanged={onChanged} />);

        fireEvent.click(screen.getByRole("button", { name: "Cancel violation" }));
        const drawer = await screen.findByTestId("reason-drawer");
        const submit = within(drawer).getByRole("button", { name: "Cancel violation" }) as HTMLButtonElement;
        expect(submit.disabled).toBe(true);
        fireEvent.change(within(drawer).getByLabelText("Reason"), { target: { value: "  entered by mistake  " } });
        expect(submit.disabled).toBe(false);
        fireEvent.click(submit);

        await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
        expect(mCancel).toHaveBeenCalledWith(1, { reason: "entered by mistake" });
    });

    it("does not flip the drawer copy to 'Reject dispute' while a cancel drawer closes", async () => {
        mCancel.mockResolvedValue(makeViolation());
        const onChanged = jest.fn();
        render(<PendingReviewPanel violations={[pending()]} onChanged={onChanged} />);
        fireEvent.click(screen.getByRole("button", { name: "Cancel violation" }));
        const drawer = await screen.findByTestId("reason-drawer");
        fireEvent.change(within(drawer).getByLabelText("Reason"), { target: { value: "mistake" } });

        fireEvent.click(within(drawer).getByRole("button", { name: "Cancel violation" }));

        await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
        expect(screen.queryByText("Reject dispute")).toBeNull();
        expect(screen.queryByLabelText("Note")).toBeNull();
    });

    it("a rejected cancel keeps the drawer open with the server message and skips onChanged", async () => {
        mCancel.mockRejectedValue(new Error("Already cancelled"));
        const onChanged = jest.fn();
        render(<PendingReviewPanel violations={[pending()]} onChanged={onChanged} />);
        fireEvent.click(screen.getByRole("button", { name: "Cancel violation" }));
        const drawer = await screen.findByTestId("reason-drawer");
        fireEvent.change(within(drawer).getByLabelText("Reason"), { target: { value: "x" } });

        fireEvent.click(within(drawer).getByRole("button", { name: "Cancel violation" }));

        expect((await within(drawer).findByRole("alert")).textContent).toBe("Already cancelled");
        expect(onChanged).not.toHaveBeenCalled();
    });

    it("lists open disputes with reason, Cancel and Reject; resolved disputes are excluded", () => {
        render(
            <PendingReviewPanel
                violations={[
                    makeViolation({ id: 5, dispute: dispute() }),
                    makeViolation({ id: 6, dispute: dispute({ outcome: "UPHELD" }) }),
                ]}
                onChanged={jest.fn()}
            />,
        );

        expect(screen.getByText("Open disputes")).toBeTruthy();
        expect(screen.getAllByTestId(/discipline-dispute/)).toHaveLength(1);
        expect(screen.getByText(/I was ill/)).toBeTruthy();
        expect(screen.getByRole("button", { name: "Cancel violation" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Reject dispute" })).toBeTruthy();
    });

    it("shows 'Confirmed automatically' on an auto-confirmed violation in the open disputes list", () => {
        render(
            <PendingReviewPanel
                violations={[
                    makeViolation({ id: 5, confirmedAutomatically: true, dispute: dispute() }),
                    makeViolation({ id: 6, confirmedAutomatically: false, dispute: dispute() }),
                ]}
                onChanged={jest.fn()}
            />,
        );

        expect(screen.getAllByText("Confirmed automatically")).toHaveLength(1);
        expect(within(screen.getByTestId("discipline-dispute-5")).getByText("Confirmed automatically")).toBeTruthy();
    });

    it("Reject dispute uses a 'Note' field and sends the trimmed note via rejectDispute", async () => {
        mReject.mockResolvedValue(makeViolation());
        const onChanged = jest.fn();
        render(<PendingReviewPanel violations={[makeViolation({ id: 5, dispute: dispute() })]} onChanged={onChanged} />);

        fireEvent.click(screen.getByRole("button", { name: "Reject dispute" }));
        const drawer = await screen.findByTestId("reason-drawer");
        const submit = within(drawer).getByRole("button", { name: "Reject dispute" }) as HTMLButtonElement;
        expect(submit.disabled).toBe(true);
        fireEvent.change(within(drawer).getByLabelText("Note"), { target: { value: " not credible " } });
        fireEvent.click(submit);

        await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
        expect(mReject).toHaveBeenCalledWith(5, { note: "not credible" });
        expect(mCancel).not.toHaveBeenCalled();
    });

    it("cancelling a disputed violation calls cancelViolation", async () => {
        mCancel.mockResolvedValue(makeViolation());
        render(<PendingReviewPanel violations={[makeViolation({ id: 5, dispute: dispute() })]} onChanged={jest.fn()} />);

        fireEvent.click(screen.getByRole("button", { name: "Cancel violation" }));
        const drawer = await screen.findByTestId("reason-drawer");
        fireEvent.change(within(drawer).getByLabelText("Reason"), { target: { value: "agreed" } });
        fireEvent.click(within(drawer).getByRole("button", { name: "Cancel violation" }));

        await waitFor(() => expect(mCancel).toHaveBeenCalledWith(5, { reason: "agreed" }));
    });
});
