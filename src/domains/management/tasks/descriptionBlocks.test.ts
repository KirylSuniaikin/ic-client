import { describe, it, expect } from "@jest/globals";
import {
    DESCRIPTION_BLOCK_DELIMITER,
    composeTaskDescription,
    parseTaskDescription,
    hasDescriptionContent,
} from "./descriptionBlocks";

describe("composeTaskDescription", () => {
    it("joins four blocks with the delimiter", () => {
        const result = composeTaskDescription({
            goal: "Sell more pizza",
            doneCriteria: "Revenue up 10%",
            progressComments: "Reached out to two new suppliers",
            blocker: "No delivery drivers",
        });

        expect(result).toBe(
            `Sell more pizza${DESCRIPTION_BLOCK_DELIMITER}Revenue up 10%${DESCRIPTION_BLOCK_DELIMITER}Reached out to two new suppliers${DESCRIPTION_BLOCK_DELIMITER}No delivery drivers`,
        );
    });

    it("trims each block before composing", () => {
        const result = composeTaskDescription({
            goal: "  Sell more pizza  ",
            doneCriteria: "  Revenue up 10%  ",
            progressComments: "  Talked to two suppliers  ",
            blocker: "  No drivers  ",
        });

        expect(result).toBe(
            `Sell more pizza${DESCRIPTION_BLOCK_DELIMITER}Revenue up 10%${DESCRIPTION_BLOCK_DELIMITER}Talked to two suppliers${DESCRIPTION_BLOCK_DELIMITER}No drivers`,
        );
    });

    it("returns an empty string (not three bare delimiters) when all four blocks are empty", () => {
        const result = composeTaskDescription({ goal: "", doneCriteria: "", progressComments: "", blocker: "" });

        expect(result).toBe("");
    });

    it("returns an empty string when all four blocks are whitespace-only", () => {
        const result = composeTaskDescription({ goal: "   ", doneCriteria: "\n", progressComments: " \t", blocker: "\t " });

        expect(result).toBe("");
    });

    it("still composes with the delimiters when only one block has content", () => {
        const result = composeTaskDescription({ goal: "Sell more pizza", doneCriteria: "", progressComments: "", blocker: "" });

        expect(result).toBe(
            `Sell more pizza${DESCRIPTION_BLOCK_DELIMITER}${DESCRIPTION_BLOCK_DELIMITER}${DESCRIPTION_BLOCK_DELIMITER}`,
        );
    });
});

describe("parseTaskDescription", () => {
    it("round-trips compose -> parse for a fully structured description", () => {
        const blocks = {
            goal: "Sell more pizza",
            doneCriteria: "Revenue up 10%",
            progressComments: "Reached out to two new suppliers",
            blocker: "No delivery drivers",
        };

        const parsed = parseTaskDescription(composeTaskDescription(blocks));

        expect(parsed).toEqual({ ...blocks, isLegacy: false });
    });

    it("round-trips a block containing the literal word 'goal' unharmed", () => {
        const blocks = {
            goal: "The goal is to increase the goal metric",
            doneCriteria: "Done Criteria: ship it",
            progressComments: "Progress Comments: goal metric up 3% so far",
            blocker: "Blocker: no goal alignment",
        };

        const parsed = parseTaskDescription(composeTaskDescription(blocks));

        expect(parsed).toEqual({ ...blocks, isLegacy: false });
    });

    it("round-trips a block containing a colon unharmed", () => {
        const blocks = { goal: "Ratio: 3:1", doneCriteria: "Time: 12:00", progressComments: "Update: on track", blocker: "Note: none" };

        const parsed = parseTaskDescription(composeTaskDescription(blocks));

        expect(parsed).toEqual({ ...blocks, isLegacy: false });
    });

    it("raw === null yields all four blocks empty and isLegacy false", () => {
        const parsed = parseTaskDescription(null);

        expect(parsed).toEqual({ goal: "", doneCriteria: "", progressComments: "", blocker: "", isLegacy: false });
    });

    it("0 delimiters: the entire raw string becomes goal, and isLegacy is true", () => {
        const raw = "A plain legacy description with no structure at all.";

        const parsed = parseTaskDescription(raw);

        expect(parsed).toEqual({ goal: raw, doneCriteria: "", progressComments: "", blocker: "", isLegacy: true });
    });

    it("an empty string (0 delimiters) is legacy with an empty goal", () => {
        const parsed = parseTaskDescription("");

        expect(parsed).toEqual({ goal: "", doneCriteria: "", progressComments: "", blocker: "", isLegacy: true });
    });

    it("malformed input with exactly 1 delimiter fills goal/doneCriteria positionally and is not legacy", () => {
        const raw = `before${DESCRIPTION_BLOCK_DELIMITER}after`;

        const parsed = parseTaskDescription(raw);

        expect(parsed.isLegacy).toBe(false);
        expect(parsed.goal).toBe("before");
        expect(parsed.doneCriteria).toBe("after");
        expect(parsed.progressComments).toBe("");
        expect(parsed.blocker).toBe("");
    });

    it("malformed input with exactly 2 delimiters fills goal/doneCriteria/progressComments positionally", () => {
        const raw = `goal text${DESCRIPTION_BLOCK_DELIMITER}done text${DESCRIPTION_BLOCK_DELIMITER}progress text`;

        const parsed = parseTaskDescription(raw);

        expect(parsed).toEqual({
            goal: "goal text",
            doneCriteria: "done text",
            progressComments: "progress text",
            blocker: "",
            isLegacy: false,
        });
    });

    it("exactly 3 delimiters splits cleanly into four blocks", () => {
        const raw = `goal text${DESCRIPTION_BLOCK_DELIMITER}done text${DESCRIPTION_BLOCK_DELIMITER}progress text${DESCRIPTION_BLOCK_DELIMITER}blocker text`;

        const parsed = parseTaskDescription(raw);

        expect(parsed).toEqual({
            goal: "goal text",
            doneCriteria: "done text",
            progressComments: "progress text",
            blocker: "blocker text",
            isLegacy: false,
        });
    });

    it("4+ delimiters: splits on the first three only, folding the rest into blocker", () => {
        const raw = `goal${DESCRIPTION_BLOCK_DELIMITER}done${DESCRIPTION_BLOCK_DELIMITER}progress${DESCRIPTION_BLOCK_DELIMITER}main${DESCRIPTION_BLOCK_DELIMITER}extra${DESCRIPTION_BLOCK_DELIMITER}more`;

        const parsed = parseTaskDescription(raw);

        expect(parsed.isLegacy).toBe(false);
        expect(parsed.goal).toBe("goal");
        expect(parsed.doneCriteria).toBe("done");
        expect(parsed.progressComments).toBe("progress");
        expect(parsed.blocker).toBe(`main${DESCRIPTION_BLOCK_DELIMITER}extra${DESCRIPTION_BLOCK_DELIMITER}more`);
    });
});

describe("hasDescriptionContent", () => {
    it("is false for null", () => {
        expect(hasDescriptionContent(null)).toBe(false);
    });

    it("is false for an empty string", () => {
        expect(hasDescriptionContent("")).toBe(false);
    });

    it("is false for a whitespace-only string", () => {
        expect(hasDescriptionContent("   \n\t")).toBe(false);
    });

    it("is true for a non-blank string", () => {
        expect(hasDescriptionContent("Sell more pizza")).toBe(true);
    });
});
