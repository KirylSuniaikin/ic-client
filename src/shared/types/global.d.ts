declare module '*.mp3' {
  const src: string;
  export default src;
}

declare module '*.json' {
  const value: unknown;
  export default value;
}

// WakeLock API — not yet in all TS lib definitions
interface WakeLockSentinel {
  release(): Promise<void>;
  readonly released: boolean;
  readonly type: 'screen';
  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
}

interface Navigator {
  wakeLock?: {
    request(type: 'screen'): Promise<WakeLockSentinel>;
  };
}

interface Window {
  fbq?: (...args: unknown[]) => void;
  ttq?: {
    track: (event: string, data?: Record<string, unknown>) => void;
    [key: string]: unknown;
  };
  // TikTok pixel bootstrap sets this string key on window
  TiktokAnalyticsObject?: string;
  [key: string]: unknown;
}
