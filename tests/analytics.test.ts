import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeAnalytics, trackAnalyticsOnce } from '../src/lib/analytics';

function browser(hostname = 'toki-matgo.vercel.app', search = '?room=0123') {
  const storage = new Map<string, string>();
  const w = {
    location: { hostname, origin: `https://${hostname}`, pathname: '/', search },
    sessionStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
    dataLayer: [] as unknown[],
  };
  vi.stubGlobal('window', w);
  vi.stubGlobal('document', { referrer: 'https://example.com/?room=9999' });
  return w;
}
const commands = (w: ReturnType<typeof browser>) =>
  w.dataLayer.map((item) => Array.from(item as ArrayLike<unknown>));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
beforeEach(() => vi.stubEnv('NODE_ENV', 'production'));

describe('GA4 minimal collection', () => {
  it('initializes only once and strips invitation queries from page and referrer', () => {
    const w = browser();
    initializeAnalytics();
    initializeAnalytics();
    const configs = commands(w).filter((c) => c[0] === 'config');
    expect(configs).toHaveLength(1);
    expect(configs[0]).toEqual([
      'config',
      'G-4TM1JD07N3',
      expect.objectContaining({
        page_location: 'https://toki-matgo.vercel.app/',
        page_referrer: 'https://example.com/',
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
      }),
    ]);
    expect(JSON.stringify(commands(w))).not.toContain('room=');
  });
  it('queues each lifecycle event once across a reload without sending its internal identity', () => {
    const w = browser();
    for (const event of ['game_start', 'game_end', 'room_create', 'room_join'] as const) {
      trackAnalyticsOnce(event, 'private-room-0123-round-1', 'multi');
      trackAnalyticsOnce(event, 'private-room-0123-round-1', 'multi');
    }
    expect(commands(w).filter((c) => c[0] === 'event')).toHaveLength(4);
    expect(JSON.stringify(commands(w))).not.toContain('private-room');
    // Reload keeps sessionStorage but recreates the Google tag queue.
    w.dataLayer = [];
    delete (w as { gtag?: unknown }).gtag;
    delete (w as { tokiGaInitialized?: boolean }).tokiGaInitialized;
    delete (w as { tokiGaSeen?: unknown }).tokiGaSeen;
    for (const event of ['game_start', 'game_end', 'room_create', 'room_join'] as const)
      trackAnalyticsOnce(event, 'private-room-0123-round-1', 'multi');
    expect(commands(w).filter((c) => c[0] === 'event')).toHaveLength(0);
    trackAnalyticsOnce('game_start', 'private-room-0123-round-2', 'multi');
    expect(commands(w).filter((c) => c[0] === 'event')).toEqual([
      ['event', 'game_start', { game_mode: 'multi' }],
    ]);
    expect(JSON.stringify(commands(w))).not.toContain('private-room');
  });
  it.each(['localhost', 'toki-matgo-git-test-gnojes.vercel.app'])('excludes %s', (host) => {
    const w = browser(host);
    initializeAnalytics();
    trackAnalyticsOnce('game_start', 'round', 'single');
    expect(w.dataLayer).toHaveLength(0);
  });
  it('excludes development and debug sessions', () => {
    const w = browser();
    vi.stubEnv('NODE_ENV', 'development');
    trackAnalyticsOnce('game_start', 'round', 'single');
    expect(w.dataLayer).toHaveLength(0);
    vi.stubEnv('NODE_ENV', 'production');
    w.location.search = '?debug=1';
    trackAnalyticsOnce('game_start', 'round', 'single');
    expect(w.dataLayer).toHaveLength(0);
  });
  it('does not interrupt play if browser storage or the tag throws', () => {
    const w = browser();
    w.sessionStorage.setItem = () => {
      throw Error('storage blocked');
    };
    expect(() => trackAnalyticsOnce('game_end', 'round', 'single')).not.toThrow();
    Object.assign(w, {
      gtag: () => {
        throw Error('tag blocked');
      },
    });
    expect(() => trackAnalyticsOnce('game_end', 'other-round', 'single')).not.toThrow();
  });
});
