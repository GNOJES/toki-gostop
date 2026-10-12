export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-4TM1JD07N3';
export type AnalyticsEvent = 'game_start' | 'game_end' | 'room_create' | 'room_join';
type GameMode = 'single' | 'multi';
type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  tokiGaInitialized?: boolean;
  tokiGaSeen?: Set<string>;
};
const STORAGE_KEY = 'toki.analytics.once.v1';

export function analyticsEnabled() {
  return (
    typeof window !== 'undefined' &&
    process.env.NODE_ENV === 'production' &&
    window.location.hostname === 'toki-matgo.vercel.app' &&
    new URLSearchParams(window.location.search).get('debug') !== '1'
  );
}
function cleanUrl(value: string) {
  try {
    const url = new URL(value);
    return url.origin + url.pathname;
  } catch {
    return '';
  }
}
export function initializeAnalytics() {
  if (!analyticsEnabled()) return;
  const w = window as AnalyticsWindow;
  if (w.tokiGaInitialized) return;
  w.dataLayer ??= [];
  w.gtag ??= function () {
    w.dataLayer!.push(arguments);
  };
  w.gtag('js', new Date());
  w.gtag('config', GA_MEASUREMENT_ID, {
    page_location: window.location.origin + window.location.pathname,
    page_referrer: cleanUrl(document.referrer),
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
  w.tokiGaInitialized = true;
}
/** The identity stays in this tab; only the event name and game mode are sent. */
export function trackAnalyticsOnce(event: AnalyticsEvent, identity: string, mode: GameMode) {
  if (!analyticsEnabled()) return;
  try {
    const w = window as AnalyticsWindow;
    w.tokiGaSeen ??= new Set<string>();
    try {
      const stored: unknown = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? '[]');
      if (Array.isArray(stored))
        for (const key of stored) if (typeof key === 'string') w.tokiGaSeen.add(key);
    } catch {
      /* In-memory deduplication still works when storage is blocked. */
    }
    const key = `${event}:${identity}`;
    if (w.tokiGaSeen.has(key)) return;
    initializeAnalytics();
    w.gtag?.('event', event, { game_mode: mode });
    w.tokiGaSeen.add(key);
    if (w.tokiGaSeen.size > 256) w.tokiGaSeen.delete(w.tokiGaSeen.values().next().value!);
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...w.tokiGaSeen]));
    } catch {
      /* Analytics must never block gameplay. */
    }
  } catch {
    /* Ad blockers or third-party tag errors must never block gameplay. */
  }
}
