import { describe, expect, it } from "@jest/globals";

import { buildAppLink, isAppHandoff } from "../benefitPayAppLink";

const MESSAGE = {
    status: "beninapp",
    appId: "1884561591",
    merchantId: "66600003",
    qrData: "QR-PAYLOAD",
    referenceNumber: "178880683057238836",
    hashedString: "HASHED",
    transactionAmount: "0.490",
    paymentType: "web",
    showResult: 0,
};

describe("isAppHandoff", () => {
    it("recognises BenefitPay's app-handoff message", () => {
        expect(isAppHandoff(MESSAGE)).toBe(true);
    });

    // The window receives messages from anything that can reach it. Reacting to the wrong one
    // would navigate the customer away mid-payment.
    it.each([
        ["a close message", { status: "benclose" }],
        ["a transaction message", { status: "bentransaction" }],
        ["an unrelated object", { hello: "world" }],
        ["a string", "beninapp"],
        ["null", null],
    ])("ignores %s", (_label, data) => {
        expect(isAppHandoff(data)).toBe(false);
    });
});

describe("buildAppLink", () => {
    const link = buildAppLink(MESSAGE, "https://icpizza.bh/benefitpay?ref=1788", "https://host");

    it("targets the SDK's own dynamic-link endpoint", () => {
        expect(link.startsWith("https://host/links/?link=")).toBe(true);
    });

    // The three that decide WHICH app opens. Wrong values send the customer to the store, or to
    // the wrong build — and they come from the vendored SDK, so they change with it.
    it("names BenefitPay's app on both platforms", () => {
        expect(link).toContain("apn=mobi.foo.benefittest");
        expect(link).toContain("isi=1237673359");
        expect(link).toContain("ios_scheme=benefitinapp");
    });

    it("carries the payment through, encoded as one link parameter", () => {
        const encoded = link.substring(link.indexOf("link=") + "link=".length, link.indexOf("&apn="));
        const inner = decodeURIComponent(encoded);

        expect(inner).toContain("referenceNumber=178880683057238836");
        expect(inner).toContain("qrdata=QR-PAYLOAD");
        expect(inner).toContain("amount=0.490");
    });

    // Without it BenefitPay has nowhere to send the customer back to, and the browser tab that
    // opened the app is left stranded.
    it("tells BenefitPay where to return the customer", () => {
        const inner = decodeURIComponent(link.substring(link.indexOf("link=") + 5, link.indexOf("&apn=")));

        expect(inner).toContain("callBackTag=https://icpizza.bh/benefitpay?ref=1788");
    });

    // A field the SDK never received posts back as the STRING "undefined". Forwarding that to the
    // wallet app makes the parameter garbage rather than absent, which reads as invalid data.
    it("never forwards the literal text undefined or null as a value", () => {
        const link = buildAppLink(
            {...MESSAGE, hashedString: "undefined", qrData: "null"},
            "https://icpizza.bh", "https://host");
        const inner = decodeURIComponent(link.substring(link.indexOf("link=") + 5, link.indexOf("&apn=")));

        expect(inner).toContain("hashedString=&");
        expect(inner).toContain("qrdata=&");
        expect(inner).not.toContain("undefined");
        expect(inner).not.toContain("null");
    });

    it("falls back to the known checkout host when the SDK has published none", () => {
        expect(buildAppLink(MESSAGE, "https://icpizza.bh", undefined))
            .toContain("benefit-checkout.test-benefitpay.bh/links/");
    });
});
