// Minimal local ambient types for the Mastercard Hosted Session SDK (session.js); no @types package.
// `Window` merges with the existing `unknown`-typed index signature in global.d.ts.

interface HostedSessionInitializedResult {
  status: "ok" | "system_error" | "request_timeout";
  message?: string;
}

type HostedSessionFieldErrorKey = "cardNumber" | "expiryMonth" | "expiryYear" | "securityCode" | "nameOnCard";

// sourceOfFunds is intentionally NOT declared: it carries a masked card number and nothing may read it.
type HostedSessionUpdateResult =
  | { status: "ok"; session: { id: string } }
  | { status: "fields_in_error"; session?: { id: string }; errors: Partial<Record<HostedSessionFieldErrorKey, string>> }
  | { status: "system_error" | "request_timeout"; session?: { id: string }; errors?: { message?: string } };

interface PaymentSessionConfigureOptions {
  session: string;
  fields: { card: { number: string; securityCode: string; expiryMonth: string; expiryYear: string; nameOnCard?: string } };
  frameEmbeddingMitigation: Array<"javascript" | "x-frame-options" | "csp">;
  callbacks: {
    initialized: (result: HostedSessionInitializedResult) => void;
    formSessionUpdate: (result: HostedSessionUpdateResult) => void;
  };
  interaction?: { displayControl?: { formatCard?: string; invalidFieldCharacters?: string } };
}

interface PaymentSessionStatic {
  configure(options: PaymentSessionConfigureOptions): void;
  updateSessionFromForm(paymentType: "card"): void;
}

interface Window {
  PaymentSession?: PaymentSessionStatic;
}
