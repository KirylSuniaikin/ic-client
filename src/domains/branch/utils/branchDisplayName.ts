import type { IBranch } from "../../management/inventory/types";

/**
 * The branch's name as a customer reading `language` should see it.
 *
 * The web twin of the backend's `Branch.displayName` and of the mobile app's helper of the same
 * name, and it has to stay one: the cart, the WhatsApp confirmation and the app all name the same
 * branch, and two fallback rules would name it in Arabic on one surface and in Latin script on the
 * next.
 *
 * Falls back to the English name when no Arabic one has been typed. Latin script inside an Arabic
 * sentence reads as an untranslated word; an empty branch name reads as a broken app.
 *
 * `language` is an i18next language tag, matched by prefix the way `localizedCountryName` matches
 * it, so `ar`, `ar-BH` and `ar-SA` all count as Arabic.
 */
export function branchDisplayName(branch: Pick<IBranch, "branchName" | "branchNameAr">, language: string): string {
    const arabic = branch.branchNameAr?.trim();
    if (language.startsWith("ar") && arabic) {
        return arabic;
    }
    // Optional-chained although the type says string: the object can come from a payload or a
    // stored copy older than this code, and a missing name must cost an empty label, not a crash.
    return branch.branchName?.trim() ?? "";
}
