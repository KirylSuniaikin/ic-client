import {describe, it, expect} from "@jest/globals";
import React from "react";
import {render, screen} from "@testing-library/react";
import type {SellsByHourStat} from "../types";

// jsdom's test environment lacks TextEncoder/TextDecoder, which @mui/x-data-grid's
// hashing util needs at import time (see StatisticsComponent.test.tsx and
// DateRangeStatsCard.test.tsx, which mock this component out entirely for that reason).
// A plain "import" of RevenueByHourTable would be hoisted by Babel's commonjs
// transform ABOVE this polyfill regardless of source order, so both the polyfill and the
// component-under-test are loaded via require() here to keep them running in the written order.
type RevenueByHourTableModule = typeof import("./RevenueByHourTable");
const nodeUtil: typeof import("util") = require("util");
if (typeof (global as {TextEncoder?: unknown}).TextEncoder === "undefined") {
    // Node's util.TextEncoder/TextDecoder are structurally compatible with the DOM
    // lib globals jsdom expects here, just not nominally typed as the same interfaces.
    global.TextEncoder = nodeUtil.TextEncoder as unknown as typeof TextEncoder;
    global.TextDecoder = nodeUtil.TextDecoder as unknown as typeof TextDecoder;
}
const {RevenueByHourTable}: RevenueByHourTableModule = require("./RevenueByHourTable");

// RevenueByHourTable.tsx builds each row's id/label off `item.Hour` (capital H) while the
// declared `SellsByHourStat` type only carries a lowercase `hour` -- a pre-existing mismatch
// called out in task-spec.md section 5 that this task explicitly does not fix. Fixtures below
// carry both keys so the component's actual read path resolves to a real row id instead of
// `undefined` (which would otherwise make DataGrid drop the row).
type RawHourRow = SellsByHourStat & { Hour: number };

const ZERO_DAY: Record<string, number> = {
    Monday: 0,
    Tuesday: 0,
    Wednesday: 0,
    Thursday: 0,
    Friday: 0,
    Saturday: 0,
    Sunday: 0,
};

function makeRow(overrides: {
    sellsByDay?: Partial<Record<string, number>>;
    ordersByDay?: Partial<Record<string, number>>;
} = {}): RawHourRow {
    return {
        hour: 18,
        Hour: 18,
        sellsByDay: {...ZERO_DAY, ...overrides.sellsByDay},
        ordersByDay: {...ZERO_DAY, ...overrides.ordersByDay},
    };
}

function cellFor(container: HTMLElement, field: string): HTMLElement {
    const cell = container.querySelector<HTMLElement>(`.MuiDataGrid-row [data-field="${field}"]`);
    if (!cell) {
        throw new Error(`No cell rendered for field "${field}"`);
    }
    return cell;
}

// renderCell sets `backgroundColor` via `sx` on the inner MUI `Box`, not on the DataGrid cell
// wrapper `[data-field]` itself -- background-color is not inherited, so reading it off the wrapper
// would read the same (unset) wrapper background for every cell regardless of `amount`, and the
// colour assertions below could never fail. Confirmed by inspecting the rendered DOM: the cell
// wrapper's only child is `.MuiBox-root`, and that is what actually carries the colour.
function heatmapBoxFor(container: HTMLElement, field: string): HTMLElement {
    const box = cellFor(container, field).querySelector<HTMLElement>(".MuiBox-root");
    if (!box) {
        throw new Error(`No heatmap Box rendered for field "${field}"`);
    }
    return box;
}

// MUI applies the heatmap colour through an emotion class, not an inline style, so it has to be
// read from the computed style -- which jsdom resolves to rgb()/hsl() form (see OrderCard.test.tsx).
function backgroundOf(cell: HTMLElement): string {
    return window.getComputedStyle(cell).backgroundColor;
}

describe("RevenueByHourTable", () => {
    it("renders 'BHD {amount} / {count}' for a cell with revenue and an order count", () => {
        const row = makeRow({sellsByDay: {Monday: 245.50}, ordersByDay: {Monday: 12}});

        render(<RevenueByHourTable rawData={[row]}/>);

        expect(screen.getByText("BHD 245.50 / 12")).toBeTruthy();
    });

    it("renders a blank cell for an hour/day entry where sellsByDay and ordersByDay are both 0", () => {
        const row = makeRow({sellsByDay: {Monday: 245.50}, ordersByDay: {Monday: 12}});
        const {container} = render(<RevenueByHourTable rawData={[row]}/>);

        const tuesdayCell = cellFor(container, "Tuesday");

        expect(tuesdayCell.textContent).toBe("");
    });

    it("never lets a different day's order count leak into this cell", () => {
        // Same revenue on both days, deliberately different order counts -- if `counts` were
        // spread positionally or keyed wrong, one day's count would bleed into the other's cell.
        const row = makeRow({
            sellsByDay: {Monday: 245.50, Wednesday: 245.50},
            ordersByDay: {Monday: 12, Wednesday: 99},
        });
        const {container} = render(<RevenueByHourTable rawData={[row]}/>);

        expect(cellFor(container, "Monday").textContent).toBe("BHD 245.50 / 12");
        expect(cellFor(container, "Wednesday").textContent).toBe("BHD 245.50 / 99");
    });

    it("keeps the heatmap background driven only by amount, not by order count", () => {
        const row = makeRow({
            sellsByDay: {Monday: 245.50, Wednesday: 245.50, Friday: 10},
            ordersByDay: {Monday: 12, Wednesday: 99, Friday: 1},
        });
        const {container} = render(<RevenueByHourTable rawData={[row]}/>);

        const mondayColor = backgroundOf(heatmapBoxFor(container, "Monday"));
        const wednesdayColor = backgroundOf(heatmapBoxFor(container, "Wednesday"));
        const fridayColor = backgroundOf(heatmapBoxFor(container, "Friday"));

        // Control: a cell with a different amount must render a different background. Without
        // this, the assertion below would still pass even if colour were constant or driven by
        // `count` -- this is what proves the test can actually see colour differences at all.
        expect(mondayColor).not.toBe(fridayColor);
        // Same amount, different order counts -> same background: colour stays keyed off amount alone.
        expect(mondayColor).toBe(wednesdayColor);
    });
});
