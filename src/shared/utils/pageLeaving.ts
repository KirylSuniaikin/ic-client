// Set by code that is about to send this document away with a full-page navigation, in the same
// tick as the navigation. The browser's own signals cannot be relied on to hold a reload back:
// beforeunload can fire inside location.assign itself, before React has committed anything that
// reacts to the emptied cart, and iOS Safari does not reliably fire it at all; pagehide waits
// until the next page commits, which a slow payment gateway or a slow confirm can take a minute
// to do.
// A navigation that never happens (the customer presses Stop) leaves the flag set, which only
// ever means no automatic reload for the rest of this page's life.
let leaving = false;

export function markPageLeaving(): void {
    leaving = true;
}

export function isPageLeaving(): boolean {
    return leaving;
}

/** For a back/forward-cache restore, which brings this same document back to life. */
export function clearPageLeaving(): void {
    leaving = false;
}
