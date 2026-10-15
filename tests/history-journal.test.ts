import { expect, it } from 'vitest';
import { persistGameProgress, readHistory, resetSoloHistory } from '../src/lib/history-store';
it('uses an idempotent in-memory fallback when browser storage is unavailable', async () => {
  await resetSoloHistory();
  const input = {
    gameId: 'fallback',
    mode: 'single' as const,
    names: ['나', 'A', 'B'] as [string, string, string],
    me: 0 as const,
    transactions: [
      {
        id: 'fallback:1',
        from: 2 as const,
        to: 0 as const,
        amount: 9n,
        kind: 'INSTANT' as const,
        reason: 'OPENING_PPUK' as const,
      },
    ],
    result: null,
  };
  await Promise.all([persistGameProgress(input), persistGameProgress(input)]);
  expect((await readHistory()).solo.points).toBe('9');
  await resetSoloHistory();
  await persistGameProgress(input);
  expect((await readHistory()).solo.points).toBe('0');
});
