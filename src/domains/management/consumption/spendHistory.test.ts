import {monthLabel, priceDirection, pricedPoints} from "./spendHistory";

describe("spendHistory helpers", () => {
    it("turns an ISO month into a short name", () => {
        expect(monthLabel("2026-05")).toBe("May");
        expect(monthLabel("2026-12")).toBe("Dec");
    });

    it("classifies the price change direction", () => {
        expect(priceDirection(12.5)).toBe("up");
        expect(priceDirection(-3)).toBe("down");
        expect(priceDirection(0)).toBe("flat");
        expect(priceDirection(null)).toBe("unknown");
    });

    it("keeps only months with a price, remembering their position", () => {
        const prices = [
            {month: "2026-06", unitPrice: null},
            {month: "2026-07", unitPrice: 2},
            {month: "2026-08", unitPrice: null},
            {month: "2026-09", unitPrice: 3},
        ];
        expect(pricedPoints(prices)).toEqual([{index: 1, unitPrice: 2}, {index: 3, unitPrice: 3}]);
    });
});
