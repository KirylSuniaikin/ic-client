import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { copyToClipboard, ClipboardCopyError } from "./copyToClipboard";

// jsdom does not implement document.execCommand -- define it as a plain jest.fn() rather than
// jest.spyOn (spyOn requires the property to already be a function on the target).
describe("copyToClipboard", () => {
    let execCommandMock: ReturnType<typeof jest.fn<boolean, [string]>>;

    beforeEach(() => {
        execCommandMock = jest.fn<boolean, [string]>().mockReturnValue(true);
        document.execCommand = execCommandMock;
    });

    afterEach(() => {
        Reflect.deleteProperty(navigator, "clipboard");
    });

    it("uses navigator.clipboard.writeText when available", async () => {
        const writeText = jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined);
        Object.defineProperty(navigator, "clipboard", {
            value: { writeText },
            configurable: true,
        });

        await copyToClipboard("alice / s3cret");

        expect(writeText).toHaveBeenCalledWith("alice / s3cret");
        expect(execCommandMock).not.toHaveBeenCalled();
    });

    it("falls back to document.execCommand('copy') when navigator.clipboard is unavailable", async () => {
        Reflect.deleteProperty(navigator, "clipboard");

        await copyToClipboard("alice / s3cret");

        expect(execCommandMock).toHaveBeenCalledWith("copy");
    });

    it("falls back to execCommand when navigator.clipboard.writeText rejects", async () => {
        const writeText = jest.fn<Promise<void>, [string]>().mockRejectedValue(new Error("denied"));
        Object.defineProperty(navigator, "clipboard", {
            value: { writeText },
            configurable: true,
        });

        await copyToClipboard("alice / s3cret");

        expect(writeText).toHaveBeenCalled();
        expect(execCommandMock).toHaveBeenCalledWith("copy");
    });

    it("throws a ClipboardCopyError when execCommand reports failure, rather than resolving silently", async () => {
        Reflect.deleteProperty(navigator, "clipboard");
        execCommandMock.mockReturnValue(false);

        await expect(copyToClipboard("alice / s3cret")).rejects.toBeInstanceOf(ClipboardCopyError);
    });
});
