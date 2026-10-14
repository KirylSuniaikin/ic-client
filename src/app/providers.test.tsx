import { describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen, act } from "@testing-library/react";
import { Box } from "@mui/material";
import i18n from "../shared/i18n";
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

    describe("document language and direction", () => {
        it("switches <html> dir and lang between Arabic and English and never adds translate=no", async () => {
            const originalLanguage = i18n.language;
            try {
                render(
                    <AppProviders>
                        <div>child</div>
                    </AppProviders>
                );

                await act(async () => {
                    await i18n.changeLanguage("ar");
                });
                expect(document.documentElement.dir).toBe("rtl");
                expect(document.documentElement.lang).toBe("ar");
                expect(document.documentElement.getAttribute("translate")).toBeNull();

                await act(async () => {
                    await i18n.changeLanguage("en");
                });
                expect(document.documentElement.dir).toBe("ltr");
                expect(document.documentElement.lang).toBe("en");
                expect(document.documentElement.getAttribute("translate")).toBeNull();
            } finally {
                await act(async () => {
                    await i18n.changeLanguage(originalLanguage);
                });
            }
        });
    });

    // Regression: `stylisPlugins` here must come from the SAME stylis instance that
    // @emotion/cache uses internally. When the app resolved its own stylis copy
    // (4.4.0) while @emotion/cache pinned 4.2.0, emotion's serializer called the
    // foreign prefixer mid-parse, which then read the *other* instance's
    // module-level tokenizer state and blew up on undefined.
    // Only selectors matching stylis' /(::plac\w+|:read-\w+)/ take that branch, so a
    // single `::placeholder` in an sx prop was enough to crash a whole page.
    describe("emotion style pipeline", () => {
        it("renders sx selectors that route through the stylis prefixer", () => {
            expect(() =>
                render(
                    <AppProviders>
                        <Box
                            sx={{
                                "& input::placeholder": { color: "#c41c00", opacity: 0.5 },
                                "& input:read-only": { color: "#008a00" },
                            }}
                        >
                            <input readOnly placeholder="styled" />
                        </Box>
                    </AppProviders>
                )
            ).not.toThrow();
        });

    });
});
