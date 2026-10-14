// Minimal local ambient types for Apple Pay JS (no @types package). Only what the web
// checkout touches. `Window` merges with the existing `unknown`-typed index signature in global.d.ts.

interface ApplePayLineItem {
  label: string;
  amount: string;
}

interface ApplePayPaymentRequest {
  countryCode: string;
  currencyCode: string;
  supportedNetworks: string[];
  merchantCapabilities: string[];
  total: ApplePayLineItem;
}

interface ApplePayValidateMerchantEvent {
  validationURL: string;
}

interface ApplePayPaymentToken {
  paymentData: unknown;
}

interface ApplePayPaymentAuthorizedEvent {
  payment: { token: ApplePayPaymentToken };
}

interface ApplePaySessionInstance {
  begin(): void;
  abort(): void;
  completeMerchantValidation(merchantSession: unknown): void;
  completePayment(status: number): void;
  onvalidatemerchant: ((event: ApplePayValidateMerchantEvent) => void) | null;
  onpaymentauthorized: ((event: ApplePayPaymentAuthorizedEvent) => void) | null;
  oncancel: (() => void) | null;
}

interface ApplePaySessionStatic {
  new (version: number, request: ApplePayPaymentRequest): ApplePaySessionInstance;
  canMakePayments(): boolean;
  supportsVersion(version: number): boolean;
  readonly STATUS_SUCCESS: number;
  readonly STATUS_FAILURE: number;
}

interface Window {
  ApplePaySession?: ApplePaySessionStatic;
}
