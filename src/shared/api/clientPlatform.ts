// task-spec.md §8. The header is unauthenticated and client-supplied — analytics only,
// never a source of authorization (mirrors the backend's ClientApp/OrderSource javadoc).
export const CLIENT_PLATFORM_HEADER = "X-Client-Platform";
export const CLIENT_PLATFORM_WEB = "web";
export const CLIENT_PLATFORM_KIOSK_WEB = "kiosk-web";

// Every call site already builds `new Headers(init?.headers)`, so this composes at the
// Headers level rather than mutating a plain RequestInit.
export function applyClientPlatform(headers: Headers, value: string = CLIENT_PLATFORM_WEB): void {
    headers.set(CLIENT_PLATFORM_HEADER, value);
}
