import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { renderHook } from "@testing-library/react";
import { logger } from "../../../../shared/utils/logger";
import { useAlertAudio } from "./useAlertAudio";
import type { Order } from "../../../order/types";

// jsdom has no real media pipeline: HTMLMediaElement.prototype.play throws "Not implemented" by
// default. Real regression this hook must guard against: a WebSocket frame can set alertOrder the
// instant the socket (re)connects, including right after page load before the staff member has
// clicked anything -- the browser then rejects the unsolicited play() (autoplay policy), and an
// uncaught rejection there used to escape as a real unhandled promise rejection (reported to the
// app's global error telemetry as production noise, not an actionable bug).
function makeOrder(overrides: Partial<Order> = {}): Order {
    return {
        id: "1",
        order_no: 4821,
        tel: "12345678",
        customer_name: "Test Customer",
        delivery_method: "Pick Up",
        payment_type: "Cash",
        address: "",
        notes: "",
        items: [],
        amount_paid: 10,
        order_type: "Pick Up",
        external_id: null,
        phone_number: "12345678",
        order_created: new Date().toISOString(),
        status: "Kitchen Phase",
        isPaid: false,
        branch_id: "branch-1",
        estimation: 15,
        ...overrides,
    };
}

describe("useAlertAudio", () => {
    // Type inferred from jest.fn<T, Y>() -- annotating with jest.Mock<…> breaks tsc (no
    // @types/jest in this project; `jest` comes from @jest/globals as a value, not a namespace).
    let playSpy = jest.fn<Promise<void>, []>();

    beforeEach(() => {
        playSpy = jest.fn<Promise<void>, []>();
        jest.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(playSpy);
        jest.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
        jest.spyOn(logger, "debug").mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("does not produce an unhandled rejection when play() is blocked by the browser's autoplay policy", async () => {
        const rejection = new DOMException(
            "play() failed because the user didn't interact with the document first.",
            "NotAllowedError"
        );
        playSpy.mockReturnValue(Promise.reject(rejection));

        const unhandled = jest.fn();
        // jsdom re-dispatches a genuinely unhandled rejection as a window event -- if the hook's
        // fix regresses, this listener is what would catch it.
        window.addEventListener("unhandledrejection", unhandled);

        const { rerender } = renderHook(({ alertOrder }: { alertOrder: Order | null }) => useAlertAudio(alertOrder, null), {
            initialProps: { alertOrder: null },
        });
        rerender({ alertOrder: makeOrder() });

        // Let the rejected play() promise's .catch() handler run.
        await Promise.resolve().then().then();

        expect(playSpy).toHaveBeenCalledTimes(1);
        expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining("Alert sound blocked"), rejection);
        expect(unhandled).not.toHaveBeenCalled();

        window.removeEventListener("unhandledrejection", unhandled);
    });

    it("still plays normally when the browser allows it", () => {
        playSpy.mockReturnValue(Promise.resolve());

        const { rerender } = renderHook(({ alertOrder }: { alertOrder: Order | null }) => useAlertAudio(alertOrder, null), {
            initialProps: { alertOrder: null },
        });
        rerender({ alertOrder: makeOrder() });

        expect(playSpy).toHaveBeenCalledTimes(1);
    });

    it("plays again for editedOrder independently of alertOrder", () => {
        playSpy.mockReturnValue(Promise.resolve());

        const { rerender } = renderHook(
            ({ editedOrder }: { editedOrder: Order | null }) => useAlertAudio(null, editedOrder),
            { initialProps: { editedOrder: null } }
        );
        rerender({ editedOrder: makeOrder({ id: "2" }) });

        expect(playSpy).toHaveBeenCalledTimes(1);
    });
});
