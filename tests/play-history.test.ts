import { expect, it } from 'vitest';
import { emptyHistory, applyProgress, parseHistory, resetSolo } from '../src/lib/play-history';
import type { ProgressInput } from '../src/lib/play-history';
const instant = {
  id: 'g:instant',
  from: 1 as const,
  to: 0 as const,
  amount: 3n,
  kind: 'INSTANT' as const,
  reason: 'OPENING_PPUK' as const,
};
function input(id = 'g', mode: 'single' | 'multi' = 'single'): ProgressInput {
  return {
    gameId: id,
    mode,
    names: ['나', '토끼 하나', '토끼 둘'],
    me: 0,
    transactions: [{ ...instant, id: `${id}:instant` }],
    result: null,
    at: 123,
  };
}
function end(i: ProgressInput): ProgressInput {
  return {
    ...i,
    result: {
      winner: 0,
      reason: 'STOP',
      settlement: {
        baseScore: 3,
        commonMultiplier: 1n,
        liabilities: [0n, 3n, 3n],
        payerFor: [null, 1, 2],
        transfers: [],
        roundDelta: [3n, -3n, 0n],
      },
    },
  };
}
it('preserves immediate points before completion without a completed record', () => {
  const seen = new Set<string>(),
    done = new Set<string>();
  const h = applyProgress(emptyHistory(), input(), seen, done);
  expect(h.solo.points).toBe('3');
  expect(h.solo.wins).toBe(0);
  expect(h.recent).toHaveLength(0);
  const next = applyProgress(h, end(input()), seen, done);
  expect(next.solo.points).toBe('3');
  expect(next.solo.wins).toBe(1);
  expect(next.recent[0].delta).toEqual(['3', '-3', '0']);
  expect(applyProgress(next, end(input()), seen, done)).toEqual(next);
});
it('keeps cumulative results and deduplication beyond a hundred recent rounds', () => {
  const seen = new Set<string>(),
    done = new Set<string>();
  let h = emptyHistory();
  for (let n = 0; n < 102; n++) h = applyProgress(h, end(input(`g${n}`)), seen, done);
  expect(h.recent).toHaveLength(100);
  expect(h.solo.wins).toBe(102);
  expect(h.solo.points).toBe('306');
  expect(applyProgress(h, end(input('g0')), seen, done)).toEqual(h);
});
it('records friends independently and reset leaves replay tombstones and friends intact', () => {
  const seen = new Set<string>(),
    done = new Set<string>();
  let h = applyProgress(emptyHistory(), end(input()), seen, done);
  h = applyProgress(h, end(input('multi', 'multi')), seen, done);
  h = resetSolo(h);
  expect(h.solo.points).toBe('0');
  expect(h.recent.map((r) => r.mode)).toEqual(['multi']);
  expect(applyProgress(h, end(input()), seen, done)).toEqual(h);
});
it('recovers corrupt storage and round trips signed large points', () => {
  expect(parseHistory('{oops')).toEqual(emptyHistory());
  const i = input();
  i.me = 1;
  i.transactions[0].amount = 2n ** 80n;
  const h = applyProgress(emptyHistory(), i, new Set(), new Set());
  expect(h.solo.points).toBe('-1208925819614629174706176');
  expect(parseHistory(JSON.stringify(h))).toEqual(h);
});
