import { describe, it, expect, beforeEach } from "@jest/globals";
import { DEFAULT_BRANCH_ID } from "../../../shared/api/client";
import type { IBranch } from "../../management/inventory/types";
import { KIOSK_BRANCH_KEY, readKioskBranch, writeKioskBranch, resolveKioskBranchId } from "./kioskBranch";

const BRANCH: IBranch = {
    id: "branch-uuid-1",
    externalId: "ext-1",
    branchNo: 1,
    branchName: "Seef",
    locale: "en",
};

describe("kioskBranch", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    // task-spec.md §14 documents this util as the single home for the 'kiosk_branch_data' literal
    // duplicated today at HomePageModals.tsx:26, useMenuData.ts:48 and useCheckout.ts:19. Pinning
    // the literal here guards against a silent rename breaking those Phase 7/8 migrations.
    it("uses the documented literal 'kiosk_branch_data' as its storage key", () => {
        expect(KIOSK_BRANCH_KEY).toBe("kiosk_branch_data");
    });

    describe("readKioskBranch", () => {
        it("returns null when nothing is stored", () => {
            expect(readKioskBranch()).toBeNull();
        });

        it("returns the parsed branch when valid JSON with an id is stored", () => {
            localStorage.setItem(KIOSK_BRANCH_KEY, JSON.stringify(BRANCH));

            expect(readKioskBranch()).toEqual(BRANCH);
        });

        // Edge case (task-spec.md §16 item 14): malformed/missing kiosk_branch_data must never
        // throw -- it must fall through to "not set" so the branch picker opens instead of
        // crashing a customer-facing screen.
        it("treats malformed JSON as not-set instead of throwing", () => {
            localStorage.setItem(KIOSK_BRANCH_KEY, "{not-json");

            expect(() => readKioskBranch()).not.toThrow();
            expect(readKioskBranch()).toBeNull();
        });

        it("treats valid JSON that has no id as not-set", () => {
            localStorage.setItem(KIOSK_BRANCH_KEY, JSON.stringify({ branchName: "Seef" }));

            expect(readKioskBranch()).toBeNull();
        });

        it("treats an empty string as not-set", () => {
            localStorage.setItem(KIOSK_BRANCH_KEY, "");

            expect(readKioskBranch()).toBeNull();
        });
    });

    describe("writeKioskBranch", () => {
        it("persists the branch under KIOSK_BRANCH_KEY, round-trippable by readKioskBranch", () => {
            writeKioskBranch(BRANCH);

            expect(localStorage.getItem(KIOSK_BRANCH_KEY)).toBe(JSON.stringify(BRANCH));
            expect(readKioskBranch()).toEqual(BRANCH);
        });
    });

    describe("resolveKioskBranchId", () => {
        it("returns the stored branch's id when one is paired", () => {
            writeKioskBranch(BRANCH);

            expect(resolveKioskBranchId()).toBe("branch-uuid-1");
        });

        it("falls back to DEFAULT_BRANCH_ID when no branch is stored", () => {
            expect(resolveKioskBranchId()).toBe(DEFAULT_BRANCH_ID);
        });

        it("falls back to DEFAULT_BRANCH_ID when the stored data is malformed", () => {
            localStorage.setItem(KIOSK_BRANCH_KEY, "{not-json");

            expect(resolveKioskBranchId()).toBe(DEFAULT_BRANCH_ID);
        });
    });
});
