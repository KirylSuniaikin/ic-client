import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MenuLoadErrorPage } from "./MenuLoadErrorPage";

describe("MenuLoadErrorPage", () => {
    const props = {
        title: "Oops, we lost connection",
        message: "Please wait a few seconds and reload the page.",
        reloadLabel: "Reload",
    };

    it("renders the title and message", () => {
        render(<MenuLoadErrorPage {...props} />);

        expect(screen.getByText(props.title)).toBeTruthy();
        expect(screen.getByText(props.message)).toBeTruthy();
    });

    it("renders the reload button with the given label", () => {
        render(<MenuLoadErrorPage {...props} />);

        expect(screen.getByRole("button", { name: props.reloadLabel })).toBeTruthy();
    });

    describe("clicking reload", () => {
        const reloadMock = jest.fn();

        beforeEach(() => {
            reloadMock.mockClear();
            Object.defineProperty(window, "location", {
                writable: true,
                configurable: true,
                value: { reload: reloadMock },
            });
        });

        it("reloads the page", () => {
            render(<MenuLoadErrorPage {...props} />);

            fireEvent.click(screen.getByRole("button", { name: props.reloadLabel }));

            expect(reloadMock).toHaveBeenCalledTimes(1);
        });
    });
});
