// Resolves which language the backend should use for customer-facing WhatsApp
// templates (order confirmation / estimation / ready / OTP) — Arabic if either
// the active i18n language or the browser locale says so.

/**
 * @param i18nLanguage - the app's active i18next language (e.g. "ar", "en-US").
 * @param includeNavigator - whether to also check `navigator.language(s)`. The kiosk
 * runs one long-lived tab per store, so its browser locale reflects the device/store,
 * not the walk-up customer — callers pass `false` there.
 */
export function resolveCustomerLanguage(i18nLanguage: string, includeNavigator = true): 'ar' | 'en' {
    if (i18nLanguage.startsWith('ar')) {
        return 'ar';
    }
    if (includeNavigator) {
        const navigatorLanguages = navigator.languages ?? [navigator.language];
        if (navigatorLanguages.some(lang => lang.startsWith('ar'))) {
            return 'ar';
        }
    }
    return 'en';
}
