import { describe, it, expect } from "@jest/globals";
import { render, screen } from "@testing-library/react";
// i18n instance (side-effect import) so `orderStatus.partDelivered`/`partOnTheWay` resolve under
// English.
import "../../../shared/i18n";

import { DeliveryPartsProgress } from "./DeliveryPartsProgress";
import type { TrackedPart } from "../types";

describe("DeliveryPartsProgress", () => {
    it("renders null (no DOM) for an empty parts array", () => {
        const { container } = render(<DeliveryPartsProgress parts={[]} />);
        expect(container.firstChild).toBeNull();
    });

    it("renders null (no DOM) for a defensive single-entry parts array", () => {
        const parts: TrackedPart[] = [{ partIndex: 1, partsTotal: 1, delivered: false }];
        const { container } = render(<DeliveryPartsProgress parts={parts} />);
        expect(container.firstChild).toBeNull();
    });

    it("renders two lines, ascending partIndex, one 'delivered' and one 'on the way', each carrying its own data-testid", () => {
        const parts: TrackedPart[] = [
            { partIndex: 1, partsTotal: 2, delivered: true },
            { partIndex: 2, partsTotal: 2, delivered: false },
        ];
        render(<DeliveryPartsProgress parts={parts} />);

        expect(screen.getByTestId("delivery-part-progress-1").textContent).toBe("Part 1 of 2 delivered");
        expect(screen.getByTestId("delivery-part-progress-2").textContent).toBe("Part 2 of 2 on the way");
    });

    it("renders the 'on the way' copy for a part whose delivered is false regardless of any other field", () => {
        const parts: TrackedPart[] = [
            { partIndex: 1, partsTotal: 3, delivered: false },
            { partIndex: 2, partsTotal: 3, delivered: false },
        ];
        render(<DeliveryPartsProgress parts={parts} />);

        expect(screen.getByTestId("delivery-part-progress-1").textContent).toBe("Part 1 of 3 on the way");
        expect(screen.getByTestId("delivery-part-progress-2").textContent).toBe("Part 2 of 3 on the way");
    });
});
