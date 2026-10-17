import { emotionRulesFor } from "../../domains/management/couriers/components/emotionRules.testutil";

/**
 * How many sheet grab handles (the 40x4 pill SheetHandle draws) are rendered under `root`. On a
 * PC dialog or panel there must be none: a handle there promises a drag that does not exist.
 *
 * Named `.testutil.ts` deliberately: CRA's testMatch collects `*.test.*`, so a helper called
 * `*.test-something` would be picked up as an empty suite and fail the run.
 */
export function sheetHandleCount(root: ParentNode): number {
    return Array.from(root.querySelectorAll("div")).filter((element) => {
        const rules = emotionRulesFor(element);
        return rules.includes("width:40px") && rules.includes("height:4px");
    }).length;
}
