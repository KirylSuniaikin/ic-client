import { describe, it, expect, beforeEach } from "@jest/globals";
import type { IBranch } from "../../management/inventory/types";
import { CHOSEN_BRANCH_KEY } from "../constants";
import { readChosenBranch, writeChosenBranch, clearChosenBranch } from "./customerBranch";

const BRANCH: IBranch = {
    id: "branch-uuid-1",
    externalId: "ext-1",
    branchNo: 1,
    branchName: "Seef",
    locale: "en",
    latitude: 26.2285,
    longitude: 50.586,
};

const BRANCH_NO_COORDS: IBranch = {
    id: "branch-uuid-2",
    externalId: "ext-2",
    branchNo: 2,
    branchName: "Karlin",
    locale: "en",
    latitude: null,
    longitude: null,
};

describe("customerBranch", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("uses the documented literal 'chosen_branch_data' as its storage key", () => {
        expect(CHOSEN_BRANCH_KEY).toBe("chosen_branch_data");
    });

    describe("readChosenBranch", () => {
        it("returns null when nothing is stored", () => {
            expect(readChosenBranch()).toBeNull();
        });

        it("returns the parsed branch when valid JSON with an id is stored", () => {
            localStorage.setItem(CHOSEN_BRANCH_KEY, JSON.stringify(BRANCH));

            expect(readChosenBranch()).toEqual(BRANCH);
        });

        // A branch with null coordinates must round-trip cleanly — it is a fully valid,
        // selectable branch, never dropped or treated as malformed (task-spec.md §7 item 1/2).
        it("returns a branch with null latitude/longitude unchanged", () => {
            localStorage.setItem(CHOSEN_BRANCH_KEY, JSON.stringify(BRANCH_NO_COORDS));

            expect(readChosenBranch()).toEqual(BRANCH_NO_COORDS);
        });

        it("treats malformed JSON as not-set instead of throwing", () => {
            localStorage.setItem(CHOSEN_BRANCH_KEY, "{not-json");

            expect(() => readChosenBranch()).not.toThrow();
            expect(readChosenBranch()).toBeNull();
        });

        it("treats valid JSON that has no id as not-set", () => {
            localStorage.setItem(CHOSEN_BRANCH_KEY, JSON.stringify({ branchName: "Seef" }));

            expect(readChosenBranch()).toBeNull();
        });

        it("treats an empty string as not-set", () => {
            localStorage.setItem(CHOSEN_BRANCH_KEY, "");

            expect(readChosenBranch()).toBeNull();
        });
    });

    describe("writeChosenBranch", () => {
        it("persists the branch under CHOSEN_BRANCH_KEY, round-trippable by readChosenBranch", () => {
            writeChosenBranch(BRANCH);

            expect(localStorage.getItem(CHOSEN_BRANCH_KEY)).toBe(JSON.stringify(BRANCH));
            expect(readChosenBranch()).toEqual(BRANCH);
        });
    });

    describe("clearChosenBranch", () => {
        it("removes the stored branch so readChosenBranch returns null again", () => {
            writeChosenBranch(BRANCH);

            clearChosenBranch();

            expect(readChosenBranch()).toBeNull();
        });

        it("is a no-op (never throws) when nothing was stored", () => {
            expect(() => clearChosenBranch()).not.toThrow();
        });
    });
});
