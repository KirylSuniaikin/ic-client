import { useEffect } from "react";

const FB_PIXEL_ID = '1717861405707714';
const TT_PIXEL_ID = 'D1SBUPRC77U25MKH1E40';

export function usePixelTracking(): void {
    useEffect(() => {
        if (!window.fbq) {
            (function (f, b, e, v, n, t, s) {
                // Facebook Pixel SDK snippet — uses dynamic property assignment on window
                if ((f as Record<string, unknown>)['fbq']) return;
                n = (f as Record<string, unknown>)['fbq'] = function () {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (n as any).callMethod ? (n as any).callMethod.apply(n, arguments) : (n as any).queue.push(arguments);
                };
                if (!(f as Record<string, unknown>)['_fbq']) (f as Record<string, unknown>)['_fbq'] = n;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (n as any).push = n;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (n as any).loaded = !0;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (n as any).version = '2.0';
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (n as any).queue = [];
                t = (b as Document).createElement(e as string) as unknown as typeof t;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (t as any).async = !0;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (t as any).src = v;
                s = (b as Document).getElementsByTagName(e as string)[0];
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (s as any).parentNode.insertBefore(t, s);
            })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js', undefined, undefined, undefined);
        }
        window.fbq?.('init', FB_PIXEL_ID);
        window.fbq?.('track', 'PageView');

        if (!window.ttq) {
            (function (w, d, t) {
                // TikTok Pixel SDK snippet — uses dynamic method assignment
                (w as Record<string, unknown>)['TiktokAnalyticsObject'] = t;
                const ttq = (w as Record<string, unknown>)[t] = (w as Record<string, unknown>)[t] || [];
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (ttq as any).methods = [
                    "page", "track", "identify", "instances", "debug", "on", "off",
                    "once", "ready", "alias", "group", "enableCookie", "disableCookie",
                    "holdConsent", "revokeConsent", "grantConsent"
                ];
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (ttq as any).setAndDefer = function (t: Record<string, unknown>, e: string) {
                    t[e] = function () {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (t as any).push([e].concat(Array.prototype.slice.call(arguments, 0)));
                    };
                };
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                for (let i = 0; i < (ttq as any).methods.length; i++) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (ttq as any).setAndDefer(ttq, (ttq as any).methods[i]);
                }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (ttq as any).load = function (e: string, n: unknown) {
                    const r = "https://analytics.tiktok.com/i18n/pixel/events.js";
                    const script = (d as Document).createElement("script");
                    script.type = "text/javascript";
                    script.async = true;
                    script.src = `${r}?sdkid=${e}&lib=${t}`;
                    const f = (d as Document).getElementsByTagName("script")[0];
                    f.parentNode?.insertBefore(script, f);
                };
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (ttq as any).load(TT_PIXEL_ID);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (ttq as any).page();
            })(window, document, 'ttq');
        }
    }, []);
}
