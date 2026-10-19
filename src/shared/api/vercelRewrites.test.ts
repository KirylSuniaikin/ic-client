import { describe, it, expect } from "@jest/globals";
import vercelConfig from "../../../vercel.json";

// vercel.json proxies the cookie-carrying customer sign-in calls through ic-pizza.com, which is where
// CUSTOMER_AUTH_BASE_URL (client.ts) sends them in production. Pinned because a broader rule such as
// `/api/auth/:path*` would also put staff login and registration behind the storefront, and a missing
// rule would leave a sign-in call landing on the SPA fallback's index.html.

const API_ORIGIN = "https://api.ic-pizza.com";

const CUSTOMER_PATHS = ["/api/auth/otp/request", "/api/auth/otp/verify", "/api/auth/refresh", "/api/auth/logout"];
const STAFF_PATHS = ["/api/auth/login", "/api/auth/register"];

// Reads only the path syntax this file uses: a trailing `:name*` matches zero or more segments and a
// bare `:name` exactly one. Anything else throws, so a rule this cannot read fails the test instead of
// slipping past it.
function sourceToRegExp(source: string): RegExp {
    const pattern = source
        .split("/")
        .filter((segment) => segment.length > 0)
        .map((segment) => {
            if (/^:\w+\*$/.test(segment)) return "(?:/.*)?";
            if (/^:\w+$/.test(segment)) return "/[^/]+";
            if (/^[\w.-]+$/.test(segment)) return `/${segment.replace(/\./g, "\\.")}`;
            throw new Error(`Unsupported rewrite source segment "${segment}" in "${source}"`);
        })
        .join("");
    return new RegExp(`^${pattern}$`);
}

function rewritesMatching(path: string): string[] {
    return vercelConfig.rewrites
        .filter((rewrite) => sourceToRegExp(rewrite.source).test(path))
        .map((rewrite) => rewrite.source);
}

describe("vercel.json rewrites", () => {
    it("proxy exactly the three customer sign-in sources to the API host", () => {
        expect(vercelConfig.rewrites).toEqual([
            { source: "/api/auth/otp/:path*", destination: `${API_ORIGIN}/api/auth/otp/:path*` },
            { source: "/api/auth/refresh", destination: `${API_ORIGIN}/api/auth/refresh` },
            { source: "/api/auth/logout", destination: `${API_ORIGIN}/api/auth/logout` },
        ]);
    });

    it.each(CUSTOMER_PATHS)("proxy the customer endpoint %s", (path) => {
        expect(rewritesMatching(path)).toHaveLength(1);
    });

    it.each(STAFF_PATHS)("never proxy the staff endpoint %s", (path) => {
        expect(rewritesMatching(path)).toEqual([]);
    });
});
