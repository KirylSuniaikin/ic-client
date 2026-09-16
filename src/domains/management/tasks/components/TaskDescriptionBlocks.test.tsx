import { describe, it, expect, jest } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import TaskDescriptionBlocks from "./TaskDescriptionBlocks";
import { composeTaskDescription } from "../descriptionBlocks";

const ALL_HEADERS_RE = /^(Goal & Description|Done Criteria|Progress Comments|Blocker)$/;

describe("TaskDescriptionBlocks", () => {
    it("renders null when description is null", () => {
        const { container } = render(<TaskDescriptionBlocks description={null} />);

        expect(container.firstChild).toBeNull();
    });

    it("renders null when description is an empty string", () => {
        const { container } = render(<TaskDescriptionBlocks description="" />);

        expect(container.firstChild).toBeNull();
    });

    it("renders null when description is whitespace-only", () => {
        const { container } = render(<TaskDescriptionBlocks description="   " />);

        expect(container.firstChild).toBeNull();
    });

    it("renders a single 'Description'-headed block for a legacy (marker-free) description", () => {
        render(<TaskDescriptionBlocks description="An old free-text description." />);

        expect(screen.getByText("Description")).toBeTruthy();
        expect(screen.getByText("An old free-text description.")).toBeTruthy();
        expect(screen.queryByText("Goal & Description")).toBeNull();
        expect(screen.queryByText("Done Criteria")).toBeNull();
        expect(screen.queryByText("Progress Comments")).toBeNull();
        expect(screen.queryByText("Blocker")).toBeNull();
    });

    it("renders four labeled blocks, in order, for a fully structured description", () => {
        const description = composeTaskDescription({
            goal: "Sell more pizza",
            doneCriteria: "Revenue up 10%",
            progressComments: "Reached out to two new suppliers",
            blocker: "No delivery drivers",
        });

        render(<TaskDescriptionBlocks description={description} />);

        const headers = screen.getAllByText(ALL_HEADERS_RE);
        expect(headers.map(el => el.textContent)).toEqual(["Goal & Description", "Done Criteria", "Progress Comments", "Blocker"]);
        expect(screen.getByText("Sell more pizza")).toBeTruthy();
        expect(screen.getByText("Revenue up 10%")).toBeTruthy();
        expect(screen.getByText("Reached out to two new suppliers")).toBeTruthy();
        expect(screen.getByText("No delivery drivers")).toBeTruthy();
        expect(screen.queryByText("Description")).toBeNull();
    });

    it("skips a block's header+body entirely when that block's text is empty", () => {
        const description = composeTaskDescription({
            goal: "Sell more pizza",
            doneCriteria: "",
            progressComments: "",
            blocker: "",
        });

        render(<TaskDescriptionBlocks description={description} />);

        expect(screen.getByText("Goal & Description")).toBeTruthy();
        expect(screen.getByText("Sell more pizza")).toBeTruthy();
        expect(screen.queryByText("Done Criteria")).toBeNull();
        expect(screen.queryByText("Progress Comments")).toBeNull();
        expect(screen.queryByText("Blocker")).toBeNull();
    });

    it("skips empty middle blocks, keeping the populated ones in order", () => {
        const description = composeTaskDescription({
            goal: "Sell more pizza",
            doneCriteria: "",
            progressComments: "Reached out to two new suppliers",
            blocker: "No delivery drivers",
        });

        render(<TaskDescriptionBlocks description={description} />);

        const headers = screen.getAllByText(ALL_HEADERS_RE);
        expect(headers.map(el => el.textContent)).toEqual(["Goal & Description", "Progress Comments", "Blocker"]);
    });

    it("renders the Progress Comments block on its own when it's the only populated block", () => {
        const description = composeTaskDescription({
            goal: "",
            doneCriteria: "",
            progressComments: "Halfway through catering setup",
            blocker: "",
        });

        render(<TaskDescriptionBlocks description={description} />);

        const headers = screen.getAllByText(ALL_HEADERS_RE);
        expect(headers.map(el => el.textContent)).toEqual(["Progress Comments"]);
        expect(screen.getByText("Halfway through catering setup")).toBeTruthy();
    });

    it("defaults to 'drawer' size when no size prop is supplied", () => {
        render(<TaskDescriptionBlocks description="Legacy text" />);

        expect(screen.getByText("Legacy text").className).toMatch(/MuiTypography-body2/);
    });

    it("uses caption-sized body text for 'card' size", () => {
        render(<TaskDescriptionBlocks description="Legacy text" size="card" />);

        expect(screen.getByText("Legacy text").className).toMatch(/MuiTypography-caption/);
    });

    it("renders a link chip with the correct href and a safe target/rel when the description contains a URL", () => {
        render(<TaskDescriptionBlocks description="Check https://example.com/path for details." />);

        const link = screen.getByRole("link");
        expect(link.getAttribute("href")).toBe("https://example.com/path");
        expect(link.getAttribute("target")).toBe("_blank");
        // review-feedback-D.md Issue 9: rel is the security-relevant half against reverse
        // tabnabbing on a user-supplied URL rendered on an authenticated admin surface.
        expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    });

    it("renders no link row when the description contains no URL", () => {
        render(<TaskDescriptionBlocks description="Plain text, no links at all." />);

        expect(screen.queryByRole("link")).toBeNull();
    });

    it("renders one deduped chip per distinct URL when multiple (incl. repeated) URLs are present", () => {
        const description = composeTaskDescription({
            goal: "See https://example.com/a and https://example.com/b",
            doneCriteria: "Also see https://example.com/a again",
            progressComments: "",
            blocker: "",
        });

        render(<TaskDescriptionBlocks description={description} />);

        const links = screen.getAllByRole("link");
        expect(links).toHaveLength(2);
        expect(links.map(link => link.getAttribute("href"))).toEqual([
            "https://example.com/a",
            "https://example.com/b",
        ]);
    });

    it("stops a card-size link click from bubbling to a parent onClick", () => {
        const parentOnClick = jest.fn();

        render(
            <div onClick={parentOnClick}>
                <TaskDescriptionBlocks description="Open https://example.com/path" size="card" />
            </div>
        );

        fireEvent.click(screen.getByRole("link"));

        expect(parentOnClick).not.toHaveBeenCalled();
    });
});
