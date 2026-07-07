import { getCookie } from './cookies';

const FBCLID_STORAGE_KEY = 'ic_fbclid_attribution';

type StoredFbclid = {
    fbclid: string;
    capturedAtSeconds: number;
};

function isStoredFbclid(value: unknown): value is StoredFbclid {
    // JSON.parse returns unknown; narrow via Record access before trusting the shape
    if (typeof value !== 'object' || value === null) return false;
    const record = value as Record<string, unknown>;
    return typeof record.fbclid === 'string' && typeof record.capturedAtSeconds === 'number';
}

// Persists the fbclid click id + capture time (epoch seconds) to localStorage,
// overwriting any prior value — last-click attribution.
export function captureFbclid(fbclid: string): void {
    const stored: StoredFbclid = {
        fbclid,
        capturedAtSeconds: Math.floor(Date.now() / 1000),
    };
    localStorage.setItem(FBCLID_STORAGE_KEY, JSON.stringify(stored));
}

export function getStoredFbclid(): StoredFbclid | undefined {
    const raw = localStorage.getItem(FBCLID_STORAGE_KEY);
    if (!raw) return undefined;

    try {
        const parsed: unknown = JSON.parse(raw);
        return isStoredFbclid(parsed) ? parsed : undefined;
    } catch {
        return undefined;
    }
}

// Prefers Meta's own _fbc cookie (canonical value); falls back to a click id
// captured from the landing URL, reconstructed into Meta's fb.1.<seconds>.<fbclid> format.
export function resolveFbc(): string | undefined {
    const cookieFbc = getCookie('_fbc');
    if (cookieFbc) return cookieFbc;

    const stored = getStoredFbclid();
    return stored ? `fb.1.${stored.capturedAtSeconds}.${stored.fbclid}` : undefined;
}

export function resolveFbp(): string | undefined {
    return getCookie('_fbp');
}
