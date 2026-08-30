import { jest, describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import SalarySlipPopup, { amountInWords } from "./SalarySlipPopup";
import type { SalarySlipForm } from "../types";

function makeForm(overrides: Partial<SalarySlipForm> = {}): SalarySlipForm {
    return {
        employeeName: "Solomon Agbeve",
        position: "Cook",
        cprNumber: "850012345",
        payPeriodLabel: "August 2026",
        paymentDate: "2026-08-31",
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
        ...overrides,
    };
}

function renderPopup(
    form: SalarySlipForm | null = makeForm(),
    onConfirm = jest.fn<void, [SalarySlipForm]>(),
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
            onClose={jest.fn<void, []>()}
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
