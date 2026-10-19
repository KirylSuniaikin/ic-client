/**
 * DOM reads for the account popups' PC suites (profile, order detail): the portal roots no role
 * query can reach. They live here because the suites' lint rules forbid direct node access.
 *
 * Named `.testutil.ts` deliberately: CRA's testMatch collects `*.test.*`, so a helper called
 * `*.test-something` would be picked up as an empty suite and fail the run.
 */

/** Every open MUI Dialog root, in document order: at an equal z-index the later one paints on top. */
export function dialogRoots(): HTMLElement[] {
    return Array.from(document.querySelectorAll<HTMLElement>(".MuiDialog-root"));
}

/** Whether a phone bottom sheet (a MUI Drawer) is on screen. */
export function hasDrawer(): boolean {
    return document.querySelector(".MuiDrawer-root") !== null;
}
