'use client';
import { useEffect, useState } from 'react';
import Script from 'next/script';
import { analyticsEnabled, GA_MEASUREMENT_ID, initializeAnalytics } from '../lib/analytics';

export function GoogleAnalytics() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    if (!analyticsEnabled()) return;
    try {
      initializeAnalytics();
      setEnabled(true);
    } catch {
      /* Optional analytics. */
    }
  }, []);
  if (!enabled) return null;
  return (
    <Script
      id="toki-ga4"
      src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
      strategy="afterInteractive"
    />
  );
}
