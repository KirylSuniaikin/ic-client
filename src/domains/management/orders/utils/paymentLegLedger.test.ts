import { describe, it, expect } from "@jest/globals";
import { createPaymentLegLedger, type PaymentLegLedger } from "./paymentLegLedger";

function makeLedger(): PaymentLegLedger {
    let n = 0;
    return createPaymentLegLedger(() => `key-${++n}`);
}

describe("paymentLegLedger", () => {
    it("reuses the key when type and amount are unchanged", () => {
        const l = makeLedger();
        const a = l.keyFor({ legId: "a", type: "Card", amount: 5 });
        expect(l.keyFor({ legId: "a", type: "Card", amount: 5 })).toBe(a);
    });

    it("mints a new key when the amount changes", () => {
        const l = makeLedger();
        const a = l.keyFor({ legId: "a", type: "Card", amount: 5 });
        expect(l.keyFor({ legId: "a", type: "Card", amount: 6 })).not.toBe(a);
    });

    it("mints a new key when the type changes", () => {
        const l = makeLedger();
        const a = l.keyFor({ legId: "a", type: "Card", amount: 5 });
        expect(l.keyFor({ legId: "a", type: "Benefit", amount: 5 })).not.toBe(a);
    });

    it("gives different legs different keys", () => {
        const l = makeLedger();
        expect(l.keyFor({ legId: "a", type: "Card", amount: 5 }))
            .not.toBe(l.keyFor({ legId: "b", type: "Card", amount: 5 }));
    });

    it("tracks settled legs and counts them", () => {
        const l = makeLedger();
        l.keyFor({ legId: "a", type: "Card", amount: 5 });
        l.keyFor({ legId: "b", type: "Card", amount: 5 });
        expect(l.isSettled("a")).toBe(false);
        l.markSettled("a");
        expect(l.isSettled("a")).toBe(true);
        expect(l.isSettled("b")).toBe(false);
        expect(l.settledCount()).toBe(1);
    });

    it("clear resets keys and settled state", () => {
        const l = makeLedger();
        const a = l.keyFor({ legId: "a", type: "Card", amount: 5 });
        l.markSettled("a");
        l.clear();
        expect(l.isSettled("a")).toBe(false);
        expect(l.settledCount()).toBe(0);
        expect(l.keyFor({ legId: "a", type: "Card", amount: 5 })).not.toBe(a);
    });
});
