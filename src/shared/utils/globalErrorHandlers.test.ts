// installGlobalErrorHandlers installs a module-level-guarded singleton window.onerror listener at
// call time, so each case needs a fresh module registry to re-install it against a fresh mock of
// reportClientError (jest.isolateModulesAsync does not exist in the Jest 27 that react-scripts
// pins -- see languageDetection.test.ts -- hence the explicit resetModules + re-import).
import { jest, describe, it, expect, beforeEach } from "@jest/globals";

// `mock`-prefixed names are the one exception babel-plugin-jest-hoist allows a jest.mock() factory
// to close over (jest.fn() itself can't be called inline in the factory when `jest` comes from an
// `import { jest } from "@jest/globals"` binding rather than the ambient global).
const mockReportClientError = jest.fn();
jest.mock("../api/telemetry", () => ({ reportClientError: mockReportClientError }));

async function installFresh(): Promise<typeof mockReportClientError> {
    jest.resetModules();
    mockReportClientError.mockClear();
    const { installGlobalErrorHandlers } = await import("./globalErrorHandlers");
    installGlobalErrorHandlers();
    return mockReportClientError;
}

beforeEach(() => {
    jest.resetModules();
});

describe("installGlobalErrorHandlers — window.onerror first-party filtering", () => {
    it("reports an error whose source matches the app's own origin", async () => {
        const reportClientError = await installFresh();

        const ownScriptUrl = `${window.location.origin}/static/js/main.abc123.js`;
        window.onerror?.("Boom", ownScriptUrl, 1, 1, new Error("Boom"));

        expect(reportClientError).toHaveBeenCalledTimes(1);
        expect(reportClientError).toHaveBeenCalledWith(expect.objectContaining({ message: "Boom" }));
    });

    it('filters out a bare cross-origin "Script error." (empty source)', async () => {
        const reportClientError = await installFresh();

        window.onerror?.("Script error.", "", 0, 0, undefined);

        expect(reportClientError).not.toHaveBeenCalled();
    });

    it("filters out an error from a third-party in-app-browser injected script (e.g. Instagram's iabjs:// bridge)", async () => {
        const reportClientError = await installFresh();

        window.onerror?.(
            "Error invoking postMessage: Java exception was raised during method invocation",
            "iabjs://navigation_performance_logger_android",
            1,
            10198,
            new Error("Error invoking postMessage: Java exception was raised during method invocation")
        );

        expect(reportClientError).not.toHaveBeenCalled();
    });

    it("filters out an error from a different (but well-formed) foreign origin", async () => {
        const reportClientError = await installFresh();

        window.onerror?.("Can't find variable: EmptyRanges", "https://some-third-party-cdn.example.com/injected.js", 1, 1, undefined);

        expect(reportClientError).not.toHaveBeenCalled();
    });

    it("still reports a genuine app error with no `error` object, as long as the source is first-party", async () => {
        const reportClientError = await installFresh();

        const ownScriptUrl = `${window.location.origin}/static/js/main.abc123.js`;
        window.onerror?.("some string-only message", ownScriptUrl, 1, 1, undefined);

        expect(reportClientError).toHaveBeenCalledTimes(1);
        expect(reportClientError).toHaveBeenCalledWith(expect.objectContaining({ message: "some string-only message" }));
    });
});
