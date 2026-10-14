import { jest, describe, it, expect, afterEach } from "@jest/globals";
import { render, screen, fireEvent, act } from "@testing-library/react";
import ApplePayNotice from "./ApplePayNotice";

const MESSAGE = "We are confirming your payment. Please do not pay again.";

afterEach(() => {
    jest.useRealTimers();
});

describe("ApplePayNotice", () => {
    it("renders nothing without a message", () => {
        const { container } = render(<ApplePayNotice message={null} />);

        expect(container.childElementCount).toBe(0);
    });

    it("stays visible after 8 s and after a click-away", () => {
        jest.useFakeTimers();
        render(<ApplePayNotice message={MESSAGE} />);

        act(() => { jest.advanceTimersByTime(60000); });
        fireEvent.click(document.body);

        expect(screen.queryByText(MESSAGE)).not.toBeNull();
    });
});
