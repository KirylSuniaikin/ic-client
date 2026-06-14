// Console log-level control, analogous to Spring's `logging.level.root`.
// Calls below the configured minimum level are dropped instead of reaching the console.
//
// The minimum level is driven by the app mode: "debug" in development, "warn" in production.
// `setLogLevel` can override it at runtime for the current session.

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

// "silent" ranks above every method so nothing passes when it is the minimum.
const RANK: Record<LogLevel, number> = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
    silent: 100,
};

function resolveMinLevel(): LogLevel {
    return process.env.NODE_ENV === "production" ? "warn" : "debug";
}

let currentMinLevel: LogLevel = resolveMinLevel();

export function getLogLevel(): LogLevel {
    return currentMinLevel;
}

function isEnabled(level: Exclude<LogLevel, "silent">): boolean {
    return RANK[level] >= RANK[currentMinLevel];
}

export const logger = {
    debug(...args: unknown[]): void {
        if (isEnabled("debug")) console.debug(...args);
    },
    info(...args: unknown[]): void {
        if (isEnabled("info")) console.info(...args);
    },
    warn(...args: unknown[]): void {
        if (isEnabled("warn")) console.warn(...args);
    },
    error(...args: unknown[]): void {
        if (isEnabled("error")) console.error(...args);
    },
};
