import { describe, it, expect } from "@jest/globals";
import { extractUrls } from "./linkify";

describe("extractUrls", () => {
    it("finds a typical URL in prose", () => {
        const result = extractUrls("Please check https://example.com/path for details.");

        expect(result).toEqual(["https://example.com/path"]);
    });

    it("strips trailing punctuation that's not part of the URL", () => {
        expect(extractUrls("See (https://example.com/foo).")).toEqual(["https://example.com/foo"]);
        expect(extractUrls("Docs: https://example.com/bar,")).toEqual(["https://example.com/bar"]);
        expect(extractUrls("List item https://example.com/baz]")).toEqual(["https://example.com/baz"]);
    });

    it("returns an empty array when no URL is present", () => {
        const result = extractUrls("No links here, just plain text.");

        expect(result).toEqual([]);
    });

    it("de-duplicates repeated URLs, preserving first-seen order", () => {
        const text = "First https://example.com/a then again https://example.com/b and https://example.com/a once more.";

        const result = extractUrls(text);

        expect(result).toEqual(["https://example.com/a", "https://example.com/b"]);
    });
});
