/**
 * Installs a `window.matchMedia` for one test. jsdom implements none, so without it MUI's
 * `useMediaQuery` always returns false and every responsive component renders its narrow path.
 *
 * Call it inside a test or a `beforeEach`, never at module scope (CRA's `resetMocks`, and a stub
 * that leaks into later suites), and pair it with `clearMatchMedia()` in `afterEach`.
 *
 * Named `.testutil.ts` deliberately: CRA's testMatch collects `*.test.*`, so a helper called
 * `*.test-something` would be picked up as an empty suite and fail the run.
 */
export function stubMatchMedia(matches: boolean): void {
    Object.defineProperty(window, "matchMedia", {
        writable: true,
        configurable: true,
        value: (query: string) => ({
            matches,
            media: query,
            onchange: null,
            addListener: (): void => {},
            removeListener: (): void => {},
            addEventListener: (): void => {},
            removeEventListener: (): void => {},
            dispatchEvent: (): boolean => false,
        }),
    });
}

/** Removes the stub, so later tests get jsdom's default again (no `matchMedia` at all). */
export function clearMatchMedia(): void {
    Reflect.deleteProperty(window, "matchMedia");
}
