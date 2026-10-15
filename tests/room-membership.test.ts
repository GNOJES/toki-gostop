import { it, expect } from 'vitest';
import { claimSeat, releaseWaitingSeat, seatForUid } from '../src/multiplayer/room-membership';
import type { RoomMeta } from '../src/multiplayer/types';
const meta = (): RoomMeta => ({
  hostUid: 'h',
  seats: { '0': 'h' },
  rosterVersion: 0,
  status: 'waiting',
  roomId: 'room1',
  createdAt: 1,
  expiresAt: Date.now() + 99999,
  updatedAt: 1,
});
it('atomically assigns distinct seats, resumes same UID and rejects fourth', () => {
  let m = claimSeat(meta(), 'a');
  m = claimSeat(m, 'b');
  expect(m.seats).toEqual({ '0': 'h', '1': 'a', '2': 'b' });
  expect(claimSeat(m, 'a')).toEqual(m);
  expect(() => claimSeat(m, 'c')).toThrow();
  expect(seatForUid(m, 'b')).toBe(2);
});
it('returns a waiting guest seat but freezes active memberships', () => {
  const m = claimSeat(meta(), 'a');
  expect(releaseWaitingSeat(m, 'a').seats).toEqual({ '0': 'h' });
  expect(() => releaseWaitingSeat({ ...m, status: 'active' }, 'a')).toThrow();
  expect(() => claimSeat({ ...m, status: 'closed' }, 'b')).toThrow();
});
