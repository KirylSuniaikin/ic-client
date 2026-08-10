import { describe, it, expect, beforeEach } from "@jest/globals";
import {
    KIOSK_DEVICE_NAME_KEY,
    getKioskDeviceName,
    setKioskDeviceName,
    clearKioskDeviceName,
} from "./kioskIdentity";

describe("kioskIdentity", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    // task-spec.md §13 pins this exact literal ("kiosk_device_name"). Guard it explicitly, not
    // just indirectly through the exported constant, since later phases wire the terminal picker
    // and X-Kiosk-Name header against this precise key.
    it("uses the documented literal 'kiosk_device_name' as its storage key", () => {
        expect(KIOSK_DEVICE_NAME_KEY).toBe("kiosk_device_name");
    });

    it("returns null when no device name has ever been set", () => {
        expect(getKioskDeviceName()).toBeNull();
    });

    it("returns the stored device name after setKioskDeviceName", () => {
        setKioskDeviceName("front-counter-1");

        expect(getKioskDeviceName()).toBe("front-counter-1");
    });

    it("persists the device name under the documented localStorage key", () => {
        setKioskDeviceName("front-counter-1");

        expect(localStorage.getItem(KIOSK_DEVICE_NAME_KEY)).toBe("front-counter-1");
    });

    it("overwrites a previously paired device name (re-pair replaces identity)", () => {
        setKioskDeviceName("front-counter-1");
        setKioskDeviceName("drive-thru-2");

        expect(getKioskDeviceName()).toBe("drive-thru-2");
    });

    it("clears the device name so getKioskDeviceName reports null again", () => {
        setKioskDeviceName("front-counter-1");

        clearKioskDeviceName();

        expect(getKioskDeviceName()).toBeNull();
    });
});
