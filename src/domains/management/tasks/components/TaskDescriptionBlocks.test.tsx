import { describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen } from "@testing-library/react";
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
});
