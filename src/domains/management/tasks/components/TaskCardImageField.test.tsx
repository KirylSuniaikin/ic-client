import { jest, describe, it, expect, beforeEach, beforeAll, afterAll } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TaskCardImageField } from "./TaskCardImageField";
import { downscaleImage } from "../../../../shared/utils/imageCompress";

jest.mock("../../../../shared/api/management");
jest.mock("../../../../shared/utils/imageCompress");

const mockDownscale = jest.mocked(downscaleImage);

// jsdom implements neither of these; the suite already stubs crypto.randomUUID the same way.
const createdUrls: string[] = [];
const revokedUrls: string[] = [];
let urlCounter = 0;
const originalCreate = (globalThis.URL as any).createObjectURL;
const originalRevoke = (globalThis.URL as any).revokeObjectURL;

beforeAll(() => {
    (globalThis.URL as any).createObjectURL = (_blob: Blob): string => {
        urlCounter += 1;
        const url = `blob:test-${urlCounter}`;
        createdUrls.push(url);
        return url;
    };
    (globalThis.URL as any).revokeObjectURL = (url: string): void => {
        revokedUrls.push(url);
    };
});

afterAll(() => {
    (globalThis.URL as any).createObjectURL = originalCreate;
    (globalThis.URL as any).revokeObjectURL = originalRevoke;
});

function renderField(overrides: Record<string, any> = {}) {
    const onChange = jest.fn();
    const props = {
        rowKey: "card-1",
        serverId: null as number | null,
        hasImage: false,
        pendingImage: null as Blob | null,
        removeImage: false,
        onChange,
        ...overrides,
    };
    const view = render(<TaskCardImageField {...(props as any)} />);
    return { ...view, onChange, props };
}

function pickFile(file: File) {
    const input = screen.getByTestId("task-image-input-card-1");
    fireEvent.change(input, { target: { files: [file] } });
}

describe("TaskCardImageField", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        createdUrls.length = 0;
        revokedUrls.length = 0;
        mockDownscale.mockResolvedValue(new Blob(["compressed"], { type: "image/jpeg" }));
    });

    it("compresses the picked file and hands the blob back through onChange", async () => {
        const { onChange } = renderField();

        pickFile(new File(["raw"], "task.jpg", { type: "image/jpeg" }));

        await waitFor(() => expect(mockDownscale).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
        const [patch] = onChange.mock.calls[0] as [any];
        expect(patch.pendingImage).toBeInstanceOf(Blob);
        expect(patch.removeImage).toBe(false);
    });

    it("shows a thumbnail once the card holds a pending image", () => {
        renderField({ pendingImage: new Blob(["x"], { type: "image/jpeg" }) });

        expect(screen.getByTestId("task-image-thumb-card-1")).toBeTruthy();
    });

    it("revokes the preview object URL on unmount", () => {
        const { unmount } = renderField({ pendingImage: new Blob(["x"], { type: "image/jpeg" }) });

        expect(createdUrls).toHaveLength(1);
        expect(revokedUrls).toHaveLength(0);

        unmount();

        // Object URLs never free themselves; an all-day tablet shift would accumulate them.
        expect(revokedUrls).toEqual(createdUrls);
    });

    it("revokes the previous preview URL when the photo is replaced", () => {
        const { rerender } = renderField({ pendingImage: new Blob(["first"], { type: "image/jpeg" }) });
        const firstUrl = createdUrls[0];

        rerender(
            <TaskCardImageField
                rowKey="card-1"
                serverId={null}
                hasImage={false}
                pendingImage={new Blob(["second"], { type: "image/jpeg" })}
                removeImage={false}
                onChange={jest.fn()}
            />
        );

        expect(revokedUrls).toContain(firstUrl);
        expect(createdUrls).toHaveLength(2);
    });

    it("offers a view action instead of an upload control when the server already holds a photo", () => {
        renderField({ hasImage: true, serverId: 42 });

        expect(screen.getByLabelText("view task photo")).toBeTruthy();
        expect(screen.queryByLabelText("upload task photo")).toBeNull();
    });

    it("offers an upload control while the card has no photo", () => {
        renderField();

        expect(screen.getByLabelText("upload task photo")).toBeTruthy();
        expect(screen.queryByLabelText("view task photo")).toBeNull();
        expect(screen.queryByLabelText("remove task photo")).toBeNull();
    });

    it("keeps the photo action and a remove control side by side once a photo exists", () => {
        renderField({ hasImage: true, serverId: 42 });

        expect(screen.getByLabelText("view task photo")).toBeTruthy();
        expect(screen.getByLabelText("remove task photo")).toBeTruthy();
    });

    it("flags removeImage when clearing a photo that exists on the server", () => {
        const { onChange } = renderField({ hasImage: true, serverId: 42 });

        fireEvent.click(screen.getByLabelText("remove task photo"));

        expect(onChange).toHaveBeenCalledWith({ pendingImage: null, removeImage: true });
    });

    it("does not flag removeImage when clearing a photo that was never uploaded", () => {
        const { onChange } = renderField({
            hasImage: false,
            pendingImage: new Blob(["x"], { type: "image/jpeg" }),
        });

        fireEvent.click(screen.getByLabelText("remove task photo"));

        expect(onChange).toHaveBeenCalledWith({ pendingImage: null, removeImage: false });
    });

    it("surfaces a compression failure without calling onChange", async () => {
        mockDownscale.mockRejectedValue(new Error("Image has unusable dimensions"));
        const { onChange } = renderField();

        pickFile(new File(["raw"], "task.jpg", { type: "image/jpeg" }));

        expect(await screen.findByTestId("task-image-error-card-1")).toBeTruthy();
        expect(onChange).not.toHaveBeenCalled();
    });
});
