export class ClipboardCopyError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ClipboardCopyError";
    }
}

// Primary path is the async Clipboard API. The APK is a Capacitor WebView pointed at the live
// site (server.url in capacitor.config.ts) so the secure-context clipboard API is normally
// available, but it must not be the only path — some WebViews report the API as present yet
// reject the call outside a user gesture, so a legacy execCommand fallback is required too.
export async function copyToClipboard(text: string): Promise<void> {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        try {
            await navigator.clipboard.writeText(text);
            return;
        } catch {
            // Fall through to the execCommand fallback below.
        }
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    let succeeded: boolean;
    try {
        // execCommand returns false (rather than throwing) when nothing was copied -- a
        // one-time-reveal password must never be reported as copied when it was not.
        succeeded = document.execCommand('copy');
    } finally {
        document.body.removeChild(textarea);
    }
    if (!succeeded) {
        throw new ClipboardCopyError('Failed to copy to clipboard');
    }
}
