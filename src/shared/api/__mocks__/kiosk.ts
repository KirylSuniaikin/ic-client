import { jest } from "@jest/globals";
import type { CreateOrderRequest, Order } from "../../../domains/order/types";
import type { PairingKiosk, InitiatePaymentResponse, PaymentResultResponse } from "../kiosk";

// Manual mock for shared/api/kiosk.ts.
// Mirrors the factoryless-mock pattern in __mocks__/public.ts: every exported function becomes a
// `jest.fn<ReturnType, ArgTypes>()`. Consumed by Phase 3/4/5 hook and component tests via
// `jest.mock("../../../shared/api/kiosk")`.

// Re-declared (not re-exported) so `instanceof PairingUnavailableError` checks in code under test
// still work when this mock module — not the real kiosk.ts — is what `import` resolves to.
export class PairingUnavailableError extends Error {
    constructor(message = "Pairing options are unavailable right now.") {
        super(message);
        this.name = "PairingUnavailableError";
    }
}

export const fetchPairingOptions = jest.fn<Promise<PairingKiosk[]>, []>();

export const createKioskOrder = jest.fn<Promise<Order>, [CreateOrderRequest]>();

export const initiateKioskPayment = jest.fn<Promise<InitiatePaymentResponse>, [string]>();

export const fetchKioskPaymentResult = jest.fn<Promise<PaymentResultResponse>, [string]>();

export const cancelKioskPayment = jest.fn<Promise<void>, [string]>();

export const deferOrderToCounter = jest.fn<Promise<void>, [string]>();

export const abandonKioskOrder = jest.fn<Promise<void>, [string]>();
