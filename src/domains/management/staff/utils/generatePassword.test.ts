import { describe, it, expect, beforeAll } from "@jest/globals";
import { generatePassword } from "./generatePassword";

const EXCLUDED_CHARS = ["0", "O", "1", "l", "I"];

// jsdom's test environment lacks crypto.getRandomValues (used by generatePassword). Mirrors the
// stub in PurchaseTablePopup.test.tsx: a deterministic-enough fill so tests don't depend on a
// real CSPRNG being present in the runtime.
beforeAll(function () {
    if (typeof globalThis.crypto === "undefined" || typeof globalThis.crypto.getRandomValues !== "function") {
        const cryptoStub = {
            getRandomValues: (arr: Uint32Array): Uint32Array => {
                for (let i = 0; i < arr.length; i++) {
                    arr[i] = Math.floor(Math.random() * 0xffffffff);
                }
                return arr;
            },
        };
        Object.defineProperty(globalThis, "crypto", { value: cryptoStub, configurable: true });
    }
});

describe("generatePassword", () => {
    it("returns a non-empty string", () => {
        const password = generatePassword();
        expect(password.length).toBeGreaterThan(0);
    });

    it("excludes ambiguous characters 0/O/1/l/I", () => {
        // Generate a lot of passwords so an excluded char reliably would have shown up if present.
        for (let i = 0; i < 50; i++) {
            const password = generatePassword();
            for (const char of EXCLUDED_CHARS) {
                expect(password.includes(char)).toBe(false);
            }
        }
    });

    it("respects a custom length", () => {
        expect(generatePassword(20)).toHaveLength(20);
    });

    it("produces different passwords across calls", () => {
        const a = generatePassword();
        const b = generatePassword();
        expect(a).not.toBe(b);
    });
});
