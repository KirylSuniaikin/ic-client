import { newIdempotencyKey } from "../../../../shared/utils/idempotencyKey";

export type PaymentLeg = { legId: string; type: string; amount: number };

export type PaymentLegLedger = {
    keyFor(leg: PaymentLeg): string;
    isSettled(legId: string): boolean;
    markSettled(legId: string): void;
    settledCount(): number;
    clear(): void;
};

type LegRecord = { signature: string; key: string; settled: boolean };

// A leg keeps its idempotency key while its type and amount are unchanged, so a re-submit after a
// failure is replayed harmlessly by the backend instead of charging twice.
export function createPaymentLegLedger(mintKey: () => string = newIdempotencyKey): PaymentLegLedger {
    const records = new Map<string, LegRecord>();

    return {
        keyFor(leg: PaymentLeg): string {
            const signature = `${leg.type}|${leg.amount.toFixed(2)}`;
            const existing = records.get(leg.legId);
            if (existing && existing.signature === signature) return existing.key;
            const key = mintKey();
            records.set(leg.legId, { signature, key, settled: false });
            return key;
        },
        isSettled(legId: string): boolean {
            return records.get(legId)?.settled ?? false;
        },
        markSettled(legId: string): void {
            const record = records.get(legId);
            if (record) record.settled = true;
        },
        settledCount(): number {
            let count = 0;
            records.forEach(r => { if (r.settled) count += 1; });
            return count;
        },
        clear(): void {
            records.clear();
        }
    };
}
