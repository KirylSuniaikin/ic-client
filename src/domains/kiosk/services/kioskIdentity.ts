// Device identity for the web kiosk. A paired device stores its own name (set once via the
// terminal picker) and sends it as `X-Kiosk-Name` on every /api/kiosk/** request (shared/api/
// kioskClient.ts, Phase 2). Outlives any single customer session — resetKioskSession (Phase 4)
// must NEVER clear this; only the triple-click re-pair gesture replaces it.
export const KIOSK_DEVICE_NAME_KEY = "kiosk_device_name";

export function getKioskDeviceName(): string | null {
    return localStorage.getItem(KIOSK_DEVICE_NAME_KEY);
}

export function setKioskDeviceName(name: string): void {
    localStorage.setItem(KIOSK_DEVICE_NAME_KEY, name);
}

export function clearKioskDeviceName(): void {
    localStorage.removeItem(KIOSK_DEVICE_NAME_KEY);
}
