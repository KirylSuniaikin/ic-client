import { jest, describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen } from "@testing-library/react";
import { EntityPhotoField } from "./EntityPhotoField";

describe("EntityPhotoField", () => {
    it("renders the file input without a capture attribute, so the OS offers gallery and camera", () => {
        render(
            <EntityPhotoField
                rowKey="row-1"
                serverId={null}
                hasImage={false}
                pendingImage={null}
                removeImage={false}
                onChange={jest.fn()}
                fetchImage={jest.fn<Promise<Blob | null>, [number]>()}
                testIdPrefix="entity-image"
                label="entity photo"
                viewerTitle="Entity photo"
            />
        );

        const input = screen.getByTestId("entity-image-input-row-1");
        expect(input.hasAttribute("capture")).toBe(false);
        expect(input.getAttribute("accept")).toBe("image/*");
    });
});
