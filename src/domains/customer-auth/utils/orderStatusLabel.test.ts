import { describe, it, expect, afterEach } from "@jest/globals";
import { act } from "@testing-library/react";
import i18n, { DEFAULT_LANGUAGE } from "../../../shared/i18n";
import { getStatusLabel, STATUS_LABEL_KEYS } from "./orderStatusLabel";
import enCustomerAuth from "../../../shared/i18n/locales/en/customerAuth.json";
import arCustomerAuth from "../../../shared/i18n/locales/ar/customerAuth.json";

// Every literal label the backend's OrderStatus enum can produce (label() values), see
// backend/src/main/java/com/icpizza/backend/domain/order/enums/OrderStatus.java. A duplicate
// label (multiple enum constants sharing the same string, e.g. ACCEPTED/A -> "Accepted") only
// needs one entry here — the map keys on the label string, not the enum constant.
const backendStatusLabels = [
    "Pending",
    "Kitchen Phase",
    "Oven",
    "Picked Up",
    "Ready",
    "Accepted",
    "Rejected",
    "New",
    "Out for delivery",
    "Delivered",
    "Cancelled",
    "Timed out",
];

function getPath(obj: Record<string, unknown>, path: string): unknown {
    return path.split(".").reduce<unknown>((acc, key) => {
        if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
            return (acc as Record<string, unknown>)[key];
        }
        return undefined;
    }, obj);
}

afterEach(async () => {
    await act(async () => {
        await i18n.changeLanguage(DEFAULT_LANGUAGE);
    });
});

describe("STATUS_LABEL_KEYS — covers every backend OrderStatus.label() value", () => {
    it.each(backendStatusLabels)("maps %s to a key that exists in en/customerAuth.json", (status) => {
        const key = STATUS_LABEL_KEYS[status];

        expect(key).toBeDefined();
        expect(getPath(enCustomerAuth, key as string)).not.toBeUndefined();
    });

    it.each(backendStatusLabels)("maps %s to a key that exists in ar/customerAuth.json (key-parallel)", (status) => {
        const key = STATUS_LABEL_KEYS[status];

        expect(key).toBeDefined();
        expect(getPath(arCustomerAuth, key as string)).not.toBeUndefined();
    });
});

describe("getStatusLabel", () => {
    it("resolves every mapped status to a real English copy string, never the raw i18n key, under the English locale", () => {
        const t = i18n.getFixedT("en", "customerAuth");

        for (const status of Object.keys(STATUS_LABEL_KEYS)) {
            const label = getStatusLabel(status, t);
            expect(label.length).toBeGreaterThan(0);
            expect(label.startsWith("orderDetail.status.")).toBe(false);
        }
    });

    it("resolves every mapped status to a non-empty Arabic label under the Arabic locale — no raw-English leak", () => {
        const t = i18n.getFixedT("ar", "customerAuth");

        for (const status of Object.keys(STATUS_LABEL_KEYS)) {
            const label = getStatusLabel(status, t);
            expect(label.length).toBeGreaterThan(0);
            // Must not silently fall through to the raw English status string.
            expect(label).not.toBe(status);
        }
    });

    it("falls back to the raw status string for an unmapped/unknown status", () => {
        const t = i18n.getFixedT("en", "customerAuth");

        expect(getStatusLabel("Some Unknown Status", t)).toBe("Some Unknown Status");
    });
});
