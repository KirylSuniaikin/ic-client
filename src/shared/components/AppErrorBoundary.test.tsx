import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen } from "@testing-library/react";

// AppErrorBoundary renders translated copy via react-i18next - initialize the
// real i18n instance (side-effect import) so keys resolve to English.
import "../i18n";

jest.mock("../api/telemetry");

import { reportClientError } from "../api/telemetry";
import { AppErrorBoundary } from "./AppErrorBoundary";

const mockReportClientError = jest.mocked(reportClientError);

function ThrowingChild(): React.JSX.Element {
    throw new Error("boom");
}

describe("AppErrorBoundary", () => {
    beforeEach(() => {
        mockReportClientError.mockClear();
        mockReportClientError.mockResolvedValue(undefined);
        jest.spyOn(console, "error").mockImplementation(() => undefined);
    });

    it("renders children when there is no error", () => {
        render(
            <AppErrorBoundary>
                <div>healthy-child</div>
            </AppErrorBoundary>
        );

        expect(screen.getByText("healthy-child")).toBeTruthy();
    });

    it("renders the fallback and reports the error when a child throws", () => {
        render(
            <AppErrorBoundary>
                <ThrowingChild />
            </AppErrorBoundary>
        );

        expect(screen.getByText("Something went wrong")).toBeTruthy();
        expect(screen.getByText("Reload")).toBeTruthy();

        expect(mockReportClientError).toHaveBeenCalledTimes(1);
        expect(mockReportClientError).toHaveBeenCalledWith(
            expect.objectContaining({ source: "error-boundary", message: "boom" })
        );
    });
});
