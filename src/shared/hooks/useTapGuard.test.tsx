import { jest, describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useTapGuard } from "./useTapGuard";
import { installPointerEvent, removePointerEvent, tap, swipe, clickWithoutPress, elapse } from "./tapGesture.testutil";

// A page that scrolls, a category row that scrolls sideways inside it, and a card in the row —
// the menu's own nesting — plus an unrelated scroller beside the row.
function Harness({ onOpen }: { onOpen: () => void }): JSX.Element {
    const guardTap = useTapGuard();
    return (
        <div data-testid="page">
            <div data-testid="row">
                <button type="button" onClick={guardTap(onOpen)}>Margherita</button>
            </div>
            <div data-testid="elsewhere" />
        </div>
    );
}

const onOpen = jest.fn<void, []>();

function mountCard(): HTMLElement {
    render(<Harness onOpen={onOpen} />);
    return screen.getByRole("button", { name: "Margherita" });
}

beforeAll(() => {
    installPointerEvent();
});

afterAll(() => {
    removePointerEvent();
});

beforeEach(() => {
    jest.useFakeTimers();
    onOpen.mockReset();
});

afterEach(() => {
    jest.useRealTimers();
});

describe("useTapGuard", () => {
    it("lets a plain tap through", () => {
        const card = mountCard();

        tap(card);

        expect(onOpen).toHaveBeenCalledTimes(1);
    });

    it("drops a tap whose finger came down while the row was still scrolling", () => {
        const card = mountCard();

        fireEvent.scroll(screen.getByTestId("row"));
        elapse(40);
        tap(card);

        expect(onOpen).not.toHaveBeenCalled();
    });

    it("drops a tap made while the page around the row was scrolling", () => {
        const card = mountCard();

        fireEvent.scroll(screen.getByTestId("page"));
        tap(card);

        expect(onOpen).not.toHaveBeenCalled();
    });

    it("treats a viewport scroll as a scroll of the whole page", () => {
        const card = mountCard();

        fireEvent.scroll(window);
        tap(card);

        expect(onOpen).not.toHaveBeenCalled();
    });

    it("lets a tap through once the scroll has settled", () => {
        const card = mountCard();

        fireEvent.scroll(screen.getByTestId("row"));
        elapse(200);
        tap(card);

        expect(onOpen).toHaveBeenCalledTimes(1);
    });

    it("drops a press that travelled past the tap slop", () => {
        const card = mountCard();

        tap(card, { travelPx: 12 });

        expect(onOpen).not.toHaveBeenCalled();
    });

    it("lets through a tap that wobbled within the tap slop", () => {
        const card = mountCard();

        tap(card, { travelPx: 6 });

        expect(onOpen).toHaveBeenCalledTimes(1);
    });

    it("keeps keyboard activation working right after a scroll", () => {
        mountCard();
        userEvent.tab();

        fireEvent.scroll(screen.getByTestId("row"));
        userEvent.keyboard("{Enter}");

        expect(onOpen).toHaveBeenCalledTimes(1);
    });

    it("keeps a mouse click working even while the page is still moving", () => {
        const card = mountCard();

        fireEvent.scroll(screen.getByTestId("page"));
        tap(card, { pointerType: "mouse" });

        expect(onOpen).toHaveBeenCalledTimes(1);
    });

    it("does not let a scroll somewhere else cost the tap", () => {
        const card = mountCard();

        fireEvent.scroll(screen.getByTestId("elsewhere"));
        tap(card);

        expect(onOpen).toHaveBeenCalledTimes(1);
    });

    it("drops a click that arrives without a press of its own just after a fling", () => {
        const card = mountCard();

        swipe(screen.getByTestId("row"));
        fireEvent.scroll(screen.getByTestId("row"));
        // The finger held still to stop the row, far longer than a press-based tap would be allowed.
        elapse(400);
        clickWithoutPress(card);

        expect(onOpen).not.toHaveBeenCalled();
    });

    it("lets a pressless click through when nothing around it has scrolled lately", () => {
        const card = mountCard();

        fireEvent.scroll(screen.getByTestId("row"));
        elapse(1100);
        clickWithoutPress(card);

        expect(onOpen).toHaveBeenCalledTimes(1);
    });

    it("lets the next deliberate tap through after dropping a stray one", () => {
        const card = mountCard();

        fireEvent.scroll(screen.getByTestId("row"));
        tap(card);
        elapse(300);
        tap(card);

        expect(onOpen).toHaveBeenCalledTimes(1);
    });
});
