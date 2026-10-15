import { expect, it } from 'vitest';
import { encodePoints, decodePoints } from '../src/game-engine/points';
it('round trips signed integers beyond safe-number precision', () => {
  for (const n of [0n, 1n, -1n, 2n ** 80n, -(2n ** 80n)])
    expect(decodePoints(encodePoints(n))).toBe(n);
});
it.each(['-0', '+1', '1.5', '1e20', ' 1', '01', 'NaN', null, 1])(
  'rejects noncanonical point value %s',
  (s) => expect(() => decodePoints(s)).toThrow(),
);
