import { describe, it, expect, afterEach } from "@jest/globals";
import { renderHook } from "@testing-library/react";
import { CARD_ROW_SX, useCardRowSx } from "./cardRowSx";
import { clearMatchMedia, stubMatchMedia } from "../../../shared/hooks/stubMatchMedia.testutil";

afterEach(() => {
    clearMatchMedia();
});

describe("useCardRowSx", () => {
    it("returns the shared row literal itself on the phone, so the phone class is unchanged", () => {
        const { result } = renderHook(() => useCardRowSx());

        expect(result.current).toBe(CARD_ROW_SX);
    });

    it("wraps the cards on PC and keeps every other key of the row", () => {
        stubMatchMedia(true);

        const { result } = renderHook(() => useCardRowSx());

        expect(result.current).toEqual({ ...CARD_ROW_SX, flexWrap: "wrap", overflowX: "visible" });
    });
});
