import { describe, it, expect } from "@jest/globals";
import { ORDER_PLACED_AUTO_RETURN_MS } from "./config";

describe("kiosk config constants", () => {
    it("auto-returns from the order-placed sheet after 15000ms", () => {
        expect(ORDER_PLACED_AUTO_RETURN_MS).toBe(15_000);
    });
});
