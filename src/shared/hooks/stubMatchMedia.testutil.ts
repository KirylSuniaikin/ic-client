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
    defineMatchMedia(() => matches);
}

/**
 * Like stubMatchMedia, but answers `(min-width:Npx)` / `(max-width:Npx)` queries for a viewport
 * `widthPx` wide, so a test can pin WHICH breakpoint a component switches at (e.g. a 768px
 * portrait iPad). Any other query does not match.
 */
export function stubViewportWidth(widthPx: number): void {
    defineMatchMedia(query => {
        const min = /min-width:\s*([\d.]+)px/.exec(query);
        if (min) return widthPx >= Number(min[1]);
        const max = /max-width:\s*([\d.]+)px/.exec(query);
        if (max) return widthPx <= Number(max[1]);
        return false;
    });
}

function defineMatchMedia(matchesQuery: (query: string) => boolean): void {
    Object.defineProperty(window, "matchMedia", {
        writable: true,
        configurable: true,
        value: (query: string) => ({
            matches: matchesQuery(query),
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
