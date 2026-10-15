import { expect, it } from 'vitest';
import { nextSeat, otherSeats, relativeSeats } from '../src/game-engine/seats';
it('cycles all three seats and skips exhausted turns', () => {
  expect(nextSeat(0, [1, 1, 1])).toBe(1);
  expect(nextSeat(1, [1, 1, 1])).toBe(2);
  expect(nextSeat(2, [1, 1, 1])).toBe(0);
  expect(nextSeat(0, [1, 0, 1])).toBe(2);
  expect(nextSeat(2, [0, 0, 1])).toBe(2);
  expect(nextSeat(0, [0, 0, 0])).toBeNull();
});
it('maps every player to distinct opponents', () => {
  expect(otherSeats(0)).toEqual([1, 2]);
  expect(otherSeats(1)).toEqual([2, 0]);
  expect(otherSeats(2)).toEqual([0, 1]);
  expect(relativeSeats(2)).toEqual({ left: 0, right: 1 });
});
