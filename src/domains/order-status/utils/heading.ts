/** Wraps any angle in degrees into [0, 360). */
export function normalizeDegrees(degrees: number): number {
    return ((degrees % 360) + 360) % 360;
}

/**
 * The signed turn, in [-180, 180), that takes a heading of `from` to `to` the short way round.
 * A naive `to - from` sends a moped going from 350° to 10° spinning 340° anticlockwise through
 * south, when the rider only leaned 20° to the right.
 */
export function shortestTurnDegrees(from: number, to: number): number {
    return normalizeDegrees(to - from + 180) - 180;
}

/**
 * The whole-degree angle a heading is drawn at, in [0, 360). The web marker's icon is a bitmap
 * rebuilt per angle, so this is also what decides whether a heading change needs a new icon at
 * all — sub-degree jitter never does.
 */
export function iconAngleOf(degrees: number): number {
    return Math.round(normalizeDegrees(degrees)) % 360;
}
