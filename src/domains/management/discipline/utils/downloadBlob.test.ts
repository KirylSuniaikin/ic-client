import { jest, describe, it, expect, afterEach } from "@jest/globals";
import { downloadBlob } from "./downloadBlob";

describe("downloadBlob", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("creates an object URL, clicks a download anchor, removes it and revokes the URL", () => {
        const blob = new Blob(["pdf"]);
        const createUrl = jest.fn<string, [Blob]>().mockReturnValue("blob:abc");
        const revokeUrl = jest.fn<void, [string]>();
        Object.defineProperty(URL, "createObjectURL", { value: createUrl, configurable: true, writable: true });
        Object.defineProperty(URL, "revokeObjectURL", { value: revokeUrl, configurable: true, writable: true });
        const clickedAnchors: HTMLAnchorElement[] = [];
        let attachedAtClick = false;
        jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
            clickedAnchors.push(this);
            attachedAtClick = document.body.contains(this);
        });

        downloadBlob(blob, "doc.pdf");

        expect(createUrl).toHaveBeenCalledWith(blob);
        expect(clickedAnchors).toHaveLength(1);
        const anchor = clickedAnchors[0];
        expect(anchor.download).toBe("doc.pdf");
        expect(anchor.href).toBe("blob:abc");
        expect(attachedAtClick).toBe(true);
        expect(document.body.contains(anchor)).toBe(false);
        expect(revokeUrl).toHaveBeenCalledWith("blob:abc");
    });
});
