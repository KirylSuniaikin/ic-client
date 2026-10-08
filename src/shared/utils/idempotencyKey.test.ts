import { afterEach, describe, expect, it } from '@jest/globals';
import { newIdempotencyKey } from './idempotencyKey';

describe('newIdempotencyKey', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto');

    afterEach(() => {
        if (original) Object.defineProperty(globalThis, 'crypto', original);
    });

    it('returns a distinct non-empty key on each call', () => {
        const a = newIdempotencyKey();
        const b = newIdempotencyKey();

        expect(a.length).toBeGreaterThan(0);
        expect(a).not.toBe(b);
    });

    it('falls back to the idem- format when crypto.randomUUID is unavailable', () => {
        Object.defineProperty(globalThis, 'crypto', { value: {}, configurable: true });

        expect(newIdempotencyKey()).toMatch(/^idem-[a-z0-9]+-[a-z0-9]+$/);
    });

    it('uses crypto.randomUUID when available', () => {
        Object.defineProperty(globalThis, 'crypto', { value: { randomUUID: () => 'uuid-1' }, configurable: true });

        expect(newIdempotencyKey()).toBe('uuid-1');
    });
});
