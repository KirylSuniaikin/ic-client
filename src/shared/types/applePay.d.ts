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
  // Safari 17+ natively, and Apple's JS SDK everywhere else. Absent on older Safari.
  applePayCapabilities?(merchantIdentifier: string): Promise<ApplePayCapabilities>;
  readonly STATUS_SUCCESS: number;
  readonly STATUS_FAILURE: number;
}

interface ApplePayCapabilities {
  paymentCredentialStatus:
    | "paymentCredentialsAvailable"
    | "paymentCredentialStatusUnknown"
    | "paymentCredentialsUnavailable"
    | "applePayUnsupported";
}

interface Window {
  ApplePaySession?: ApplePaySessionStatic;
}

// Apple's <apple-pay-button> web component, defined by the Apple Pay JS SDK. Outside Safari it is
// the only button face there is: the -apple-pay-button CSS appearance renders nothing elsewhere.
declare namespace JSX {
  interface IntrinsicElements {
    "apple-pay-button": {
      buttonstyle?: "black" | "white" | "white-outline";
      type?: "buy" | "plain" | "order" | "pay" | "check-out" | "continue";
      locale?: string;
      role?: string;
      "aria-label"?: string;
      "aria-disabled"?: boolean;
      "data-testid"?: string;
      style?: Record<string, string | number>;
      onClick?: () => void;
    };
  }
}
