import type { SeatId, SeatTuple } from './types';
export const otherSeats = (me: SeatId): [SeatId, SeatId] => [
  ((me + 1) % 3) as SeatId,
  ((me + 2) % 3) as SeatId,
];
export function nextSeat(current: SeatId, turns: SeatTuple<number>): SeatId | null {
  for (let i = 1; i <= 3; i++) {
    const seat = ((current + i) % 3) as SeatId;
    if (turns[seat] > 0) return seat;
  }
  return null;
}
export function relativeSeats(me: SeatId) {
  const [left, right] = otherSeats(me);
  return { left, right };
}
