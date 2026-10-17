import { describe, it, expect } from "@jest/globals";
import { HOME_ICON_URL, mopedIconUrl } from "./trackingMarkerArt";

function svgOf(dataUrl: string): string {
    return decodeURIComponent(dataUrl.slice(dataUrl.indexOf(",") + 1));
}

describe("mopedIconUrl", () => {
    it("is an SVG data URL with the heading drawn in, turned about the pivot at the canvas centre", () => {
        const url = mopedIconUrl(90);

        expect(url.startsWith("data:image/svg+xml;charset=UTF-8,")).toBe(true);
        expect(svgOf(url)).toContain('<g transform="rotate(90 20 20)">');
        expect(svgOf(url)).toContain('viewBox="0 0 40 40"');
    });

    it("draws the moped in the brand red", () => {
        expect(svgOf(mopedIconUrl(0))).toContain('fill="#E44B4C"');
    });

    it("hands back the identical URL for a heading within the same whole degree, so the browser reuses the decoded image", () => {
        expect(mopedIconUrl(45.2)).toBe(mopedIconUrl(44.8));
        expect(mopedIconUrl(359.7)).toBe(mopedIconUrl(0));
        expect(mopedIconUrl(46)).not.toBe(mopedIconUrl(45));
    });
});

describe("HOME_ICON_URL", () => {
    it("is the 32x42 home marker as an SVG data URL", () => {
        expect(HOME_ICON_URL.startsWith("data:image/svg+xml;charset=UTF-8,")).toBe(true);
        expect(svgOf(HOME_ICON_URL)).toContain('viewBox="0 0 32 42"');
        expect(svgOf(HOME_ICON_URL)).not.toContain("rotate(");
    });
});
