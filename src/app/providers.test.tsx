import { describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen } from "@testing-library/react";
import { AppProviders } from "./providers";

describe("AppProviders", () => {
    describe("children rendering", () => {
        it("renders a single child element", () => {
            render(
                <AppProviders>
                    <div>app-child-content</div>
                </AppProviders>
            );

            expect(screen.getByText("app-child-content")).toBeTruthy();
        });

        it("renders nested children without throwing", () => {
            expect(() =>
                render(
                    <AppProviders>
                        <>
                            <span>child-one</span>
                            <span>child-two</span>
                        </>
                    </AppProviders>
                )
            ).not.toThrow();
        });

        it("renders multiple sibling children", () => {
            render(
                <AppProviders>
                    <>
                        <span>sibling-a</span>
                        <span>sibling-b</span>
                    </>
                </AppProviders>
            );

            expect(screen.getByText("sibling-a")).toBeTruthy();
            expect(screen.getByText("sibling-b")).toBeTruthy();
        });
    });
});
