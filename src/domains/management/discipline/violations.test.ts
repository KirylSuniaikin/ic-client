import { describe, it, expect } from "@jest/globals";
import { canConfirmNow, canDispute, hasOpenDispute, isExplanationWindowOpen, partitionViolations } from "./violations";
import { makeViolation } from "./testFixtures";
import type { DisputeTO, ViolationTO } from "./types";

const DUE = "2026-10-09T10:00:00"; // Bahrain local time
const DUE_MS = Date.parse("2026-10-09T10:00:00+03:00");

const dispute = (outcome: DisputeTO["outcome"]): DisputeTO => ({
    reason: "unfair", disputedAt: "2026-10-08T09:00:00", outcome,
    resolvedByName: null, resolvedAt: null, resolutionNote: null,
});

describe("partitionViolations", () => {
    it("puts unexpired ACTIVE in active and PENDING_EXPLANATION in pending", () => {
        const active = makeViolation({ id: 1, status: "ACTIVE" });
        const pending = makeViolation({ id: 2, status: "PENDING_EXPLANATION" });
        const expired = makeViolation({ id: 3, status: "ACTIVE", expired: true });
        const cancelled = makeViolation({ id: 4, status: "CANCELLED" });

        const result = partitionViolations([active, pending, expired, cancelled]);

        expect(result.active).toEqual([active]);
        expect(result.pending).toEqual([pending]);
    });

    it("returns empty lists for empty input", () => {
        expect(partitionViolations([])).toEqual({ active: [], pending: [] });
    });
});

describe("isExplanationWindowOpen", () => {
    const v = makeViolation({ status: "PENDING_EXPLANATION", explanationDueAt: DUE });

    it("is open before and exactly at the due time", () => {
        expect(isExplanationWindowOpen(v, DUE_MS - 1)).toBe(true);
        expect(isExplanationWindowOpen(v, DUE_MS)).toBe(true);
    });

    it("is closed after the due time", () => {
        expect(isExplanationWindowOpen(v, DUE_MS + 1)).toBe(false);
    });
});

describe("canConfirmNow", () => {
    it("is false when not explained and the window is open", () => {
        const v = makeViolation({ explanationDueAt: DUE, explainedAt: null });
        expect(canConfirmNow(v, DUE_MS - 1000)).toBe(false);
    });

    it("is true when explained, even inside the window", () => {
        const v = makeViolation({ explanationDueAt: DUE, explainedAt: "2026-10-08T09:00:00" });
        expect(canConfirmNow(v, DUE_MS - 1000)).toBe(true);
    });

    it("is true once the window has elapsed without an explanation", () => {
        const v = makeViolation({ explanationDueAt: DUE, explainedAt: null });
        expect(canConfirmNow(v, DUE_MS + 1000)).toBe(true);
    });
});

describe("canDispute", () => {
    it("is true for an unexpired, undisputed ACTIVE class A-C violation", () => {
        expect(canDispute(makeViolation({ violationClass: "C" }))).toBe(true);
    });

    const blocked: Array<[string, Partial<ViolationTO>]> = [
        ["pending", { status: "PENDING_EXPLANATION" }],
        ["cancelled", { status: "CANCELLED" }],
        ["expired", { expired: true }],
        ["class D", { violationClass: "D" }],
        ["already disputed", { dispute: dispute(null) }],
    ];
    it.each(blocked)("is false when %s", (_name, overrides) => {
        expect(canDispute(makeViolation(overrides))).toBe(false);
    });
});

describe("hasOpenDispute", () => {
    it("is false with no dispute", () => {
        expect(hasOpenDispute(makeViolation())).toBe(false);
    });

    it("is true while the outcome is null", () => {
        expect(hasOpenDispute(makeViolation({ dispute: dispute(null) }))).toBe(true);
    });

    it("is false once resolved", () => {
        expect(hasOpenDispute(makeViolation({ dispute: dispute("UPHELD") }))).toBe(false);
        expect(hasOpenDispute(makeViolation({ dispute: dispute("CANCELLED") }))).toBe(false);
    });
});
