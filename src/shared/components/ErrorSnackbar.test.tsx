import { jest, describe, it, expect, afterEach } from "@jest/globals";
import React from "react";
import { render, screen, act } from "@testing-library/react";
import ErrorSnackbar from "./ErrorSnackbar";

describe("ErrorSnackbar", () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    describe("rendering", () => {
        it("renders message text when open", () => {
            render(
                <ErrorSnackbar
                    open={true}
                    message="Something went wrong"
                    severity="error"
                    handleClose={jest.fn()}
                />
            );

            expect(screen.getByText("Something went wrong")).toBeTruthy();
        });

        it("renders without error when duration is omitted", () => {
            expect(() =>
                render(
                    <ErrorSnackbar
                        open={true}
                        message="Test message"
                        severity="success"
                        handleClose={jest.fn()}
                    />
                )
            ).not.toThrow();
        });

        it("renders without error when duration=10000", () => {
            expect(() =>
                render(
                    <ErrorSnackbar
                        open={true}
                        message="Blacklist message"
                        severity="error"
                        handleClose={jest.fn()}
                        duration={10000}
                    />
                )
            ).not.toThrow();
        });
    });

    describe("duration prop — autoHideDuration", () => {
        it("calls handleClose after 4000ms when duration is omitted (default 4000)", () => {
            jest.useFakeTimers();
            const handleClose = jest.fn<void, []>();

            render(
                <ErrorSnackbar
                    open={true}
                    message="Auto-close test"
                    severity="error"
                    handleClose={handleClose}
                />
            );

            act(() => {
                jest.advanceTimersByTime(4001);
            });

            expect(handleClose).toHaveBeenCalled();
        });

        it("does not call handleClose at 4000ms when duration=10000", () => {
            jest.useFakeTimers();
            const handleClose = jest.fn<void, []>();

            render(
                <ErrorSnackbar
                    open={true}
                    message="Blacklist content"
                    severity="error"
                    handleClose={handleClose}
                    duration={10000}
                />
            );

            act(() => {
                jest.advanceTimersByTime(4001);
            });

            expect(handleClose).not.toHaveBeenCalled();
        });

        it("calls handleClose after 10000ms when duration=10000 (blacklist use case)", () => {
            jest.useFakeTimers();
            const handleClose = jest.fn<void, []>();

            render(
                <ErrorSnackbar
                    open={true}
                    message="Blacklist content"
                    severity="error"
                    handleClose={handleClose}
                    duration={10000}
                />
            );

            act(() => {
                jest.advanceTimersByTime(10001);
            });

            expect(handleClose).toHaveBeenCalled();
        });
    });
});
