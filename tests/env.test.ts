import { expect, it } from 'vitest';
import { validateFirebaseEnv } from '../scripts/validate-env.mjs';
const good = {
  FIREBASE_EXPECTED_PROJECT_ID: 'toki-gostop',
  NEXT_PUBLIC_APP_ORIGIN: 'https://toki-gostop.vercel.app',
  NEXT_PUBLIC_GA_MEASUREMENT_ID: 'G-GOSTOPTEST',
  NEXT_PUBLIC_FIREBASE_API_KEY: 'test-key',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'toki-gostop.firebaseapp.com',
  NEXT_PUBLIC_FIREBASE_DATABASE_URL:
    'https://toki-gostop-default-rtdb.asia-southeast1.firebasedatabase.app',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'toki-gostop',
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'toki-gostop.firebasestorage.app',
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '651336244726',
  NEXT_PUBLIC_FIREBASE_APP_ID: '1:651336244726:web:abc',
};
it('rejects missing and cross-project production config without printing values', () => {
  expect(() => validateFirebaseEnv(good)).not.toThrow();
  expect(() => validateFirebaseEnv({ ...good, NEXT_PUBLIC_FIREBASE_API_KEY: '' })).toThrow(
    'API_KEY',
  );
  expect(() =>
    validateFirebaseEnv({ ...good, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'another.firebaseapp.com' }),
  ).toThrow('AUTH_DOMAIN');
  expect(() =>
    validateFirebaseEnv({ ...good, NEXT_PUBLIC_FIREBASE_USE_EMULATORS: 'true' }),
  ).toThrow('EMULATORS');
  expect(() =>
    validateFirebaseEnv({ ...good, NEXT_PUBLIC_FIREBASE_DATABASE_URL: 'http://localhost:9000' }),
  ).toThrow('DATABASE_URL');
});

it('rejectsOriginalProject even when all Firebase values agree', () => {
  const original = Object.fromEntries(
    Object.entries(good).map(([k, v]) => [k, v.replaceAll('toki-gostop', 'toki-matgo')]),
  );
  expect(() => validateFirebaseEnv(original)).toThrow(/original|matgo/i);
});
it('rejectsMismatchedExpectedId and missing production origin or GA', () => {
  expect(() => validateFirebaseEnv({ ...good, FIREBASE_EXPECTED_PROJECT_ID: 'another' })).toThrow(
    /EXPECTED/,
  );
  expect(() => validateFirebaseEnv({ ...good, NEXT_PUBLIC_APP_ORIGIN: '' })).toThrow(/ORIGIN/);
  expect(() => validateFirebaseEnv({ ...good, NEXT_PUBLIC_GA_MEASUREMENT_ID: '' })).toThrow(/GA/);
});
it('accepts demo build only in explicit local CI context', () => {
  const demo = Object.fromEntries(
    Object.entries(good).map(([k, v]) => [k, v.replaceAll('toki-gostop', 'demo-toki-gostop')]),
  );
  expect(() => validateFirebaseEnv(demo)).toThrow(/demo|CI/);
  expect(() => validateFirebaseEnv({ ...demo, CI: 'true', APP_BUILD_CONTEXT: 'ci' })).not.toThrow();
  expect(() =>
    validateFirebaseEnv({ ...demo, CI: 'true', APP_BUILD_CONTEXT: 'ci', VERCEL_ENV: 'production' }),
  ).toThrow(/demo|CI/);
});
