import { describe, it, expect } from "@jest/globals";
import {
    DELIVERY_STAGES,
    MAX_RIDE_FILL,
    PICKUP_STAGES,
    computeRideProgress,
    isDeliveryOrder,
    stageIndexIn,
    stagesFor,
} from "./orderStages";

const MINUTE = 60_000;

describe("stagesFor", () => {
    it("gives a delivery order the five-step ladder the notification bar already draws", () => {
        expect(stagesFor("Delivery").map((s) => s.key)).toEqual([
            "Kitchen Phase",
            "Oven",
            "Ready",
            "Out for delivery",
            "Delivered",
        ]);
    });

    it("gives a pickup order the three-step ladder", () => {
        expect(stagesFor("Pick Up").map((s) => s.key)).toEqual(["Kitchen Phase", "Oven", "Ready"]);
    });

    it("falls back to the pickup ladder for a missing order type", () => {
        expect(stagesFor(undefined)).toBe(PICKUP_STAGES);
        expect(isDeliveryOrder(undefined)).toBe(false);
    });

    // The bar's ceiling is what makes "Ready" mean 2-of-4 on a delivery instead of "done" —
    // the exact mistake the backend's DELIVERY_MAX_STEP comment calls out.
    it("does not end a delivery order at Ready", () => {
        expect(stageIndexIn(DELIVERY_STAGES, "Ready")).toBe(2);
        expect(DELIVERY_STAGES.length - 1).toBe(4);
    });
});

describe("stageIndexIn", () => {
    it("locates the ride on the delivery ladder", () => {
        expect(stageIndexIn(DELIVERY_STAGES, "Out for delivery")).toBe(3);
    });

    it("falls back to the first stage for an unknown status", () => {
        expect(stageIndexIn(DELIVERY_STAGES, "initial-creation")).toBe(0);
        expect(stageIndexIn(PICKUP_STAGES, null)).toBe(0);
    });
});

describe("computeRideProgress", () => {
    const handoverMs = 1_000_000;
    const arrivalMs = handoverMs + 20 * MINUTE;

    // The elapsed-time calculation itself. usePreciseCountdown feeds `arrival - now`, so
    // msToArrival = 15 min means 5 of the ride's 20 minutes have gone.
    it("fills by elapsed time between the ride starting and the expected arrival", () => {
        const quarterWay = computeRideProgress(handoverMs, arrivalMs, 15 * MINUTE);
        const halfWay = computeRideProgress(handoverMs, arrivalMs, 10 * MINUTE);
        const threeQuarters = computeRideProgress(handoverMs, arrivalMs, 5 * MINUTE);

        expect(quarterWay?.fraction).toBeCloseTo(0.25 * MAX_RIDE_FILL, 6);
        expect(halfWay?.fraction).toBeCloseTo(0.5 * MAX_RIDE_FILL, 6);
        expect(threeQuarters?.fraction).toBeCloseTo(0.75 * MAX_RIDE_FILL, 6);
    });

    it("starts at zero at the moment of handover and reports the whole ride as minutes left", () => {
        const atHandover = computeRideProgress(handoverMs, arrivalMs, 20 * MINUTE);

        expect(atHandover?.fraction).toBe(0);
        expect(atHandover?.minutesLeft).toBe(20);
        expect(atHandover?.overdue).toBe(false);
    });

    it("counts the minutes left down as the ride progresses", () => {
        expect(computeRideProgress(handoverMs, arrivalMs, 15 * MINUTE)?.minutesLeft).toBe(15);
        expect(computeRideProgress(handoverMs, arrivalMs, 90_000)?.minutesLeft).toBe(2);
    });

    // The overrun contract: the bar stops rather than claiming an arrival that has not happened.
    it("holds below a full segment and flags overdue once the estimate is passed", () => {
        const justPassed = computeRideProgress(handoverMs, arrivalMs, 0);
        const wayPassed = computeRideProgress(handoverMs, arrivalMs, -12 * MINUTE);

        expect(justPassed?.fraction).toBe(MAX_RIDE_FILL);
        expect(wayPassed?.fraction).toBe(MAX_RIDE_FILL);
        expect(MAX_RIDE_FILL).toBeLessThan(1);
        expect(justPassed?.overdue).toBe(true);
        expect(wayPassed?.overdue).toBe(true);
    });

    it("never reports negative minutes left once the estimate is passed", () => {
        expect(computeRideProgress(handoverMs, arrivalMs, -12 * MINUTE)?.minutesLeft).toBe(0);
    });

    it("never returns a fraction outside the segment, at any point of the ride", () => {
        const samples = [30, 20, 10, 0, -30].map((m) =>
            computeRideProgress(handoverMs, arrivalMs, m * MINUTE));

        samples.forEach((sample) => {
            expect(sample).not.toBeNull();
            expect(sample?.fraction).toBeGreaterThanOrEqual(0);
            expect(sample?.fraction).toBeLessThanOrEqual(MAX_RIDE_FILL);
        });
    });

    // Null, not 0 — 0 would draw a bar claiming the courier has not left the kitchen.
    it("returns null when either timestamp is missing", () => {
        expect(computeRideProgress(null, arrivalMs, 5 * MINUTE)).toBeNull();
        expect(computeRideProgress(handoverMs, null, 5 * MINUTE)).toBeNull();
        expect(computeRideProgress(null, null, 5 * MINUTE)).toBeNull();
    });

    it("returns null for a non-positive ride window rather than dividing by zero", () => {
        expect(computeRideProgress(handoverMs, handoverMs, 0)).toBeNull();
        expect(computeRideProgress(arrivalMs, handoverMs, 0)).toBeNull();
    });
});
