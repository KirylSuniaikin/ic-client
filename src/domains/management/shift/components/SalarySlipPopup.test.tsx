import { jest, describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import SalarySlipPopup, { amountInWords } from "./SalarySlipPopup";
import type { SalarySlipPopupProps } from "./SalarySlipPopup";
import type { SalarySlipForm, SalarySlipPenalty, ShiftDateRange } from "../types";

function makeForm(overrides: Partial<SalarySlipForm> = {}): SalarySlipForm {
    return {
        employeeName: "Solomon Agbeve",
        position: "Cook",
        cprNumber: "850012345",
        payPeriodLabel: "August 2026",
        paymentDate: "2026-08-31",
        periodStart: "2026-07-25",
        periodEnd: "2026-08-24",
        basicSalary: 240,
        housingAllowance: 40,
        transportAllowance: 10,
        overtimeHours: 20.96,
        overtimeRate: 1,
        overtimeAmount: 20.96,
        deductions: [],
        grossEarnings: 310.96,
        totalDeductions: 0,
        netPay: 310.96,
        amountInWords: "Bahraini Dinars Three Hundred And Ten and Fils Nine Hundred And Sixty Only",
        notes: ["1. Basic Salary of BD 240.000 paid in full with no deduction."],
        penalty: null,
        ...overrides,
    };
}

function renderPopup(
    form: SalarySlipForm | null = makeForm(),
    onConfirm = jest.fn<void, [SalarySlipForm]>(),
    onPeriodChange = jest.fn<void, [ShiftDateRange]>(),
    props: Partial<SalarySlipPopupProps> = {},
): typeof onConfirm {
    render(
        <SalarySlipPopup
            open
            form={form}
            employeeLabel="Solomon Agbeve"
            loading={false}
            submitting={false}
            error={null}
            onConfirm={onConfirm}
            onPeriodChange={onPeriodChange}
            onClose={jest.fn<void, []>()}
            {...props}
        />,
    );
    return onConfirm;
}

function input(testId: string): HTMLInputElement {
    return screen.getByTestId(testId).querySelector("input") as HTMLInputElement;
}

// The amount-in-words field is multiline, so MUI renders a textarea rather than an input.
function textArea(testId: string): HTMLTextAreaElement {
    return screen.getByTestId(testId).querySelector("textarea") as HTMLTextAreaElement;
}

describe("SalarySlipPopup", () => {
    it("pre-fills every printed field from the preview", () => {
        renderPopup();

        expect(input("slip-employee-name").value).toBe("Solomon Agbeve");
        expect(input("slip-position").value).toBe("Cook");
        expect(input("slip-cpr").value).toBe("850012345");
        expect(input("slip-pay-period").value).toBe("August 2026");
        expect(input("slip-payment-date").value).toBe("2026-08-31");
        expect(input("slip-basic").value).toBe("240");
        expect(input("slip-gross").value).toBe("310.96");
        expect(input("slip-net").value).toBe("310.96");
    });

    it("recalculates gross, net and the wording as amounts are edited", () => {
        renderPopup();

        fireEvent.change(input("slip-basic"), { target: { value: "200" } });

        expect(input("slip-gross").value).toBe("270.96");
        expect(input("slip-net").value).toBe("270.96");
        expect(textArea("slip-words").value).toContain("Two Hundred And Seventy");
    });

    it("subtracts a deduction from the net pay", () => {
        renderPopup();

        fireEvent.click(screen.getByTestId("slip-add-deduction"));
        fireEvent.change(input("slip-deduction-desc-0"), { target: { value: "Advance salary" } });
        fireEvent.change(input("slip-deduction-amount-0"), { target: { value: "10.96" } });

        expect(input("slip-total-deductions").value).toBe("10.96");
        expect(input("slip-net").value).toBe("300");
    });

    it("renders a server-supplied deduction, totals it, reduces net pay and confirms it", () => {
        const onConfirm = renderPopup(makeForm({
            deductions: [{ description: "Penalty deduction", amount: 10 }],
            totalDeductions: 10,
            netPay: 300.96,
        }));

        expect(input("slip-deduction-desc-0").value).toBe("Penalty deduction");
        expect(input("slip-deduction-amount-0").value).toBe("10");
        expect(input("slip-total-deductions").value).toBe("10");
        expect(input("slip-net").value).toBe("300.96");

        fireEvent.click(screen.getByTestId("slip-confirm"));

        expect(onConfirm).toHaveBeenCalledTimes(1);
        const sent = onConfirm.mock.calls[0][0];
        expect(sent.deductions).toEqual([{ description: "Penalty deduction", amount: 10 }]);
    });

    it("renders a prefilled penalty-hours deduction and comment note, totals them and confirms them unchanged", () => {
        const penaltyLine = { description: "Penalty hours (disciplinary): 4.00 hrs @ 1.500/hr", amount: 6 };
        const penaltyNote =
            "Penalty hours of 4.00 hrs (BD 6.000) are not paid because of disciplinary violations recorded in this pay period.";
        const onConfirm = renderPopup(makeForm({
            deductions: [penaltyLine],
            totalDeductions: 6,
            netPay: 304.96,
            notes: ["1. Basic Salary of BD 240.000 paid in full.", penaltyNote],
        }));

        expect(input("slip-deduction-desc-0").value).toBe(penaltyLine.description);
        expect(input("slip-deduction-amount-0").value).toBe("6");
        expect(input("slip-total-deductions").value).toBe("6");
        expect(input("slip-net").value).toBe("304.96");
        expect(input("slip-note-1").value).toBe(penaltyNote);

        fireEvent.click(screen.getByTestId("slip-confirm"));

        const sent = onConfirm.mock.calls[0][0];
        expect(sent.deductions).toEqual([penaltyLine]);
        expect(sent.notes).toEqual(["1. Basic Salary of BD 240.000 paid in full.", penaltyNote]);
        expect(sent.totalDeductions).toBe(6);
        expect(sent.netPay).toBe(304.96);
    });

    it("labels the hours field as paid overtime and explains the one-hour cap", () => {
        renderPopup();

        expect(screen.getByLabelText("Paid OT hours")).toBeTruthy();
        expect(screen.getByText(/at most 1 hour per shift is paid/)).toBeTruthy();
    });

    it("recomputes the overtime amount when the rate changes", () => {
        renderPopup();

        fireEvent.change(input("slip-ot-rate"), { target: { value: "1.5" } });

        // 20.96 hrs x 1.5
        expect(input("slip-ot-amount").value).toBe("31.44");
        // and it flows through gross and net: 240 + 40 + 10 + 31.44
        expect(input("slip-gross").value).toBe("321.44");
        expect(input("slip-net").value).toBe("321.44");
    });

    it("recomputes the overtime amount when the hours change", () => {
        renderPopup();

        fireEvent.change(input("slip-ot-hours"), { target: { value: "10" } });

        expect(input("slip-ot-amount").value).toBe("10");
    });

    // Seeded from the server rather than recomputed on open: hours and rate are rounded
    // separately by the shift aggregation, so multiplying them back can drift from the amount it
    // actually computed.
    it("keeps the server's overtime amount until an operand is touched", () => {
        renderPopup(makeForm({ overtimeHours: 20.96, overtimeRate: 1.234, overtimeAmount: 25.864 }));

        expect(input("slip-ot-amount").value).toBe("25.864");
    });

    it("stops following hours x rate once the amount is typed into directly", () => {
        renderPopup();

        fireEvent.change(input("slip-ot-amount"), { target: { value: "99" } });
        fireEvent.change(input("slip-ot-rate"), { target: { value: "2" } });

        expect(input("slip-ot-amount").value).toBe("99");
    });

    it("resumes following hours x rate when the pinned amount is reset", () => {
        renderPopup();

        fireEvent.change(input("slip-ot-amount"), { target: { value: "99" } });
        fireEvent.click(screen.getByTestId("slip-ot-amount-reset"));

        // back to 20.96 x 1
        expect(input("slip-ot-amount").value).toBe("20.96");
    });

    // Both behaviours were asked for: every field editable, AND every field verifiable. So an
    // override is honoured but never silent -- the calculated figure stays on screen beside it.
    it("keeps an overridden total but flags that it no longer matches the rows", () => {
        renderPopup();

        fireEvent.change(input("slip-gross"), { target: { value: "999" } });

        expect(input("slip-gross").value).toBe("999");
        expect(screen.getByTestId("slip-gross-mismatch").textContent).toContain("310.960");
    });

    it("restores the calculated total when the override is reset", () => {
        renderPopup();

        fireEvent.change(input("slip-gross"), { target: { value: "999" } });
        fireEvent.click(screen.getByTestId("slip-gross-reset"));

        expect(input("slip-gross").value).toBe("310.96");
        expect(screen.queryByTestId("slip-gross-mismatch")).toBeNull();
    });

    it("sends the confirmed values, edits included", () => {
        const onConfirm = renderPopup();

        fireEvent.change(input("slip-basic"), { target: { value: "260" } });
        fireEvent.change(input("slip-employee-name"), { target: { value: "Edited Name" } });
        fireEvent.click(screen.getByTestId("slip-confirm"));

        expect(onConfirm).toHaveBeenCalledTimes(1);
        const sent = onConfirm.mock.calls[0][0];
        expect(sent.basicSalary).toBe(260);
        expect(sent.employeeName).toBe("Edited Name");
        expect(sent.grossEarnings).toBe(330.96);
    });

    it("blocks confirming while an amount is negative", () => {
        const onConfirm = renderPopup();

        fireEvent.change(input("slip-basic"), { target: { value: "-5" } });

        expect(screen.getByTestId("slip-blocker").textContent).toContain("negative");
        expect((screen.getByTestId("slip-confirm") as HTMLButtonElement).disabled).toBe(true);
        fireEvent.click(screen.getByTestId("slip-confirm"));
        expect(onConfirm).not.toHaveBeenCalled();
    });

    it("blocks confirming while a deduction has no description", () => {
        renderPopup();

        fireEvent.click(screen.getByTestId("slip-add-deduction"));
        fireEvent.change(input("slip-deduction-amount-0"), { target: { value: "5" } });

        expect(screen.getByTestId("slip-blocker").textContent).toContain("description");
        expect((screen.getByTestId("slip-confirm") as HTMLButtonElement).disabled).toBe(true);
    });

    it("drops blank note lines rather than printing empty rows", () => {
        const onConfirm = renderPopup();

        fireEvent.click(screen.getByTestId("slip-add-note"));
        fireEvent.click(screen.getByTestId("slip-confirm"));

        expect(onConfirm.mock.calls[0][0].notes).toEqual([
            "1. Basic Salary of BD 240.000 paid in full with no deduction.",
        ]);
    });

    // The window is the backend's own (the pay cycle by default); the popup renders it verbatim.
    it("shows the shift dates the preview was summed over", () => {
        renderPopup();

        expect(input("shift-range-from").value).toBe("2026-07-25");
        expect(input("shift-range-to").value).toBe("2026-08-24");
    });

    it("asks for a reload when a valid range is picked", () => {
        const onPeriodChange = jest.fn<void, [ShiftDateRange]>();
        renderPopup(makeForm(), undefined, onPeriodChange);

        fireEvent.change(input("shift-range-from"), { target: { value: "2026-08-01" } });

        expect(onPeriodChange).toHaveBeenCalledTimes(1);
        expect(onPeriodChange).toHaveBeenCalledWith({ from: "2026-08-01", to: "2026-08-24" });
    });

    it("does not reload while From is after To, and says why", () => {
        const onPeriodChange = jest.fn<void, [ShiftDateRange]>();
        renderPopup(makeForm(), undefined, onPeriodChange);

        fireEvent.change(input("shift-range-from"), { target: { value: "2026-08-30" } });

        expect(onPeriodChange).not.toHaveBeenCalled();
        expect(screen.getByText("From must be on or before To")).toBeTruthy();
    });

    // The server ignores these on POST, but the body is typed as the full form -- they are echoed
    // exactly as previewed rather than dropped or recomputed.
    it("echoes the previewed shift dates back on confirm", () => {
        const onConfirm = renderPopup();

        fireEvent.click(screen.getByTestId("slip-confirm"));

        const sent = onConfirm.mock.calls[0][0];
        expect(sent.periodStart).toBe("2026-07-25");
        expect(sent.periodEnd).toBe("2026-08-24");
    });

    // A reload mid-download would swap the figures under a PDF that is already being rendered.
    it("locks the shift dates while the slip is being generated", () => {
        renderPopup(makeForm(), undefined, undefined, { submitting: true });

        expect(input("shift-range-from").disabled).toBe(true);
        expect(input("shift-range-to").disabled).toBe(true);
    });

    // Leaving a typed date blurs it on the mousedown of the next click, which starts the reload
    // before that click lands -- so the buttons must still be there to receive it.
    it("keeps Cancel working but holds Confirm while the new dates load", () => {
        const onConfirm = jest.fn<void, [SalarySlipForm]>();
        const onClose = jest.fn<void, []>();
        renderPopup(makeForm(), onConfirm, undefined, { loading: true, onClose });

        expect(screen.getByTestId("salary-slip-loading")).toBeTruthy();
        expect(screen.queryByTestId("shift-range-from")).toBeNull();
        expect((screen.getByTestId("slip-confirm") as HTMLButtonElement).disabled).toBe(true);
        fireEvent.click(screen.getByTestId("slip-confirm"));
        fireEvent.click(screen.getByText("Cancel"));

        expect(onConfirm).not.toHaveBeenCalled();
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    // A failed reload hands back the slip that was already shown; its dates must be those, not the
    // range that was just rejected.
    it("shows the error above the current slip so the dates can be corrected", () => {
        renderPopup(makeForm(), undefined, undefined, { error: "HTTP 400" });

        expect(screen.getByTestId("salary-slip-error").textContent).toBe("HTTP 400");
        expect(input("shift-range-from").value).toBe("2026-07-25");
        expect(input("shift-range-from").disabled).toBe(false);
    });

    // Mirrors the backend's one-page budget; the server does the exact check, this just stops the
    // owner discovering it only after pressing Confirm.
    it("stops adding rows at the point the slip would overflow one page", () => {
        renderPopup();

        for (let i = 0; i < 5; i++) {
            const add = screen.getByTestId("slip-add-deduction") as HTMLButtonElement;
            if (add.disabled) break;
            fireEvent.click(add);
        }

        expect((screen.getByTestId("slip-add-deduction") as HTMLButtonElement).disabled).toBe(true);
    });
});

function makePenalty(overrides: Partial<SalarySlipPenalty> = {}): SalarySlipPenalty {
    return {
        entries: [
            { code: "1.3", title: "Leaving the shift early", issuedOn: "2026-08-03", hours: 2, pending: false },
            { code: "2.1", title: "Non-compliance with recipe", issuedOn: "2026-08-10", hours: 2, pending: true },
        ],
        totalHours: 4,
        capHours: 6,
        deductedHours: 4,
        deductedAmount: 6,
        capped: false,
        ...overrides,
    };
}

describe("SalarySlipPopup penalty section", () => {
    it("is hidden when penalty is null", () => {
        renderPopup(makeForm({ penalty: null }));

        expect(screen.queryByText("Penalty hours")).toBeNull();
        expect(screen.queryByText(/Total penalty hours/)).toBeNull();
        expect(screen.queryByText(/Deducted this period/)).toBeNull();
    });

    it("lists each entry with code, title, date and hours, marking only pending ones", () => {
        renderPopup(makeForm({ penalty: makePenalty() }));

        expect(screen.getByText("Penalty hours")).toBeTruthy();
        const confirmed = screen.getByText(/1\.3 — Leaving the shift early/).textContent ?? "";
        const pending = screen.getByText(/2\.1 — Non-compliance with recipe/).textContent ?? "";
        expect(confirmed).toContain("2026-08-03");
        expect(confirmed).not.toContain("(pending confirmation)");
        expect(pending).toContain("(pending confirmation)");
    });

    it("shows the total hours and the deducted hours and amount", () => {
        renderPopup(makeForm({ penalty: makePenalty({ totalHours: 4, deductedHours: 3, deductedAmount: 4.5 }) }));

        expect(screen.getByText(/Total penalty hours/).textContent).toContain("4");
        const deducted = screen.getByText(/Deducted this period/).textContent ?? "";
        expect(deducted).toContain("3");
        expect(deducted).toContain("4.5");
    });

    it("shows the cap note only when capped", () => {
        const note = /The deduction is limited to the hours worked in the employee's 5 latest shifts \(6 h\)\./;
        const first = render(
            <SalarySlipPopup open form={makeForm({ penalty: makePenalty({ capped: false }) })} employeeLabel="x"
                loading={false} submitting={false} error={null} onConfirm={jest.fn<void, [SalarySlipForm]>()}
                onPeriodChange={jest.fn<void, [ShiftDateRange]>()} onClose={jest.fn<void, []>()} />,
        );
        expect(screen.queryByText(note)).toBeNull();
        first.unmount();

        renderPopup(makeForm({ penalty: makePenalty({ capped: true, totalHours: 9, deductedHours: 6 }) }));
        expect(screen.getByText(note)).toBeTruthy();
    });

    it("leaves the deduction limit and totals untouched and adds no deduction rows for entries", () => {
        renderPopup(makeForm({ penalty: makePenalty() }));

        expect(screen.queryByTestId("slip-deduction-desc-0")).toBeNull();
        expect(input("slip-total-deductions").value).toBe("0");
        for (let i = 0; i < 5; i++) {
            const add = screen.getByTestId("slip-add-deduction") as HTMLButtonElement;
            if (add.disabled) break;
            fireEvent.click(add);
        }
        expect(screen.getAllByLabelText("Description")).toHaveLength(3);
        expect((screen.getByTestId("slip-add-deduction") as HTMLButtonElement).disabled).toBe(true);
    });

    it("posts penalty back unchanged on confirm", () => {
        const penalty = makePenalty({ capped: true, totalHours: 9, deductedHours: 6 });
        const onConfirm = renderPopup(makeForm({ penalty }));

        fireEvent.click(screen.getByTestId("slip-confirm"));

        expect(onConfirm.mock.calls[0][0].penalty).toEqual(penalty);
    });

    it("posts a null penalty back as null", () => {
        const onConfirm = renderPopup(makeForm({ penalty: null }));

        fireEvent.click(screen.getByTestId("slip-confirm"));

        expect(onConfirm.mock.calls[0][0].penalty).toBeNull();
    });

    it("renders 15 entries inside a scrollable, height-limited list", () => {
        const entries = Array.from({ length: 15 }, (_, i) => ({
            code: `3.${i + 1}`, title: `Entry title ${i + 1}`, issuedOn: "2026-08-05", hours: 1, pending: false,
        }));
        renderPopup(makeForm({ penalty: makePenalty({ entries, totalHours: 15 }) }));

        const first = screen.getByText(/3\.1 — Entry title 1,/);
        const last = screen.getByText(/3\.15 — Entry title 15/);
        let node: HTMLElement | null = first;
        let scrollable: HTMLElement | null = null;
        while (node !== null && scrollable === null) {
            const style = getComputedStyle(node);
            if (style.overflowY === "auto" && style.maxHeight !== "" && style.maxHeight !== "none") scrollable = node;
            node = node.parentElement;
        }
        expect(scrollable).not.toBeNull();
        expect(scrollable?.contains(last)).toBe(true);
    });
});

// The popup spells the amount client-side so the sentence tracks the net pay as it is edited,
// instead of round-tripping to the server on every keystroke. It has to agree with the backend's
// BhdAmountInWords, so the same cases are pinned on both sides.
describe("amountInWords", () => {
    it("spells whole dinars without a fils clause", () => {
        expect(amountInWords(200)).toBe("Bahraini Dinars Two Hundred Only");
    });

    it("spells dinars and fils", () => {
        expect(amountInWords(310.96)).toBe(
            "Bahraini Dinars Three Hundred And Ten and Fils Nine Hundred And Sixty Only",
        );
    });

    it("spells a fils-only amount", () => {
        expect(amountInWords(0.5)).toBe("Bahraini Dinars Zero and Fils Five Hundred Only");
    });

    it("spells zero", () => {
        expect(amountInWords(0)).toBe("Bahraini Dinars Zero Only");
    });

    // These are BhdAmountInWordsTest's own cases. The popup spells client-side, so a divergence
    // here would mean a confirmed slip prints different wording from an un-edited one.
    it.each([
        [200, "Bahraini Dinars Two Hundred Only"],
        [0.5, "Bahraini Dinars Zero and Fils Five Hundred Only"],
        [0, "Bahraini Dinars Zero Only"],
        [274.88, "Bahraini Dinars Two Hundred And Seventy Four and Fils Eight Hundred And Eighty Only"],
        [1005, "Bahraini Dinars One Thousand Five Only"],
        [2000, "Bahraini Dinars Two Thousand Only"],
        [12345, "Bahraini Dinars Twelve Thousand Three Hundred And Forty Five Only"],
        [45, "Bahraini Dinars Forty Five Only"],
        [315, "Bahraini Dinars Three Hundred And Fifteen Only"],
        [1.05, "Bahraini Dinars One and Fils Fifty Only"],
        [5.005, "Bahraini Dinars Five and Fils Five Only"],
    ])("agrees with the backend for %p", (amount: number, expected: string) => {
        expect(amountInWords(amount)).toBe(expected);
    });

    it("spells thousands", () => {
        expect(amountInWords(1234.567)).toBe(
            "Bahraini Dinars One Thousand Two Hundred And Thirty Four and Fils Five Hundred And Sixty Seven Only",
        );
    });
});
