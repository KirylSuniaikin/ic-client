import { jest, describe, it, expect, beforeEach, beforeAll, afterAll } from "@jest/globals";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { TaskCardImageThumb } from "./TaskCardImageThumb";
import { fetchTaskCardImage } from "../../../../shared/api/management";

jest.mock("../../../../shared/api/management");

const mockFetch = jest.mocked(fetchTaskCardImage);

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

describe("TaskCardImageThumb", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        createdUrls.length = 0;
        revokedUrls.length = 0;
    });

    it("fetches the stored photo and renders it once loaded", async () => {
        mockFetch.mockResolvedValue(new Blob(["x"], { type: "image/jpeg" }));

        render(<TaskCardImageThumb taskCardId={7} />);

        expect(mockFetch).toHaveBeenCalledWith(7);
        expect(await screen.findByTestId("task-image-thumb-7")).toBeTruthy();
    });

    it("renders nothing when the card has no stored photo", async () => {
        mockFetch.mockResolvedValue(null);

        render(<TaskCardImageThumb taskCardId={7} />);

        await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(7));
        expect(screen.queryByTestId("task-image-thumb-7")).toBeNull();
    });

    it("revokes the object URL on unmount", async () => {
        mockFetch.mockResolvedValue(new Blob(["x"], { type: "image/jpeg" }));

        const { unmount } = render(<TaskCardImageThumb taskCardId={7} />);
        await screen.findByTestId("task-image-thumb-7");

        expect(createdUrls).toHaveLength(1);
        unmount();

        expect(revokedUrls).toEqual(createdUrls);
    });
});
