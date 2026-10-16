import { it, expect, vi } from 'vitest';
import type { RoomMeta } from '../src/multiplayer/types';
vi.mock('firebase/database', () => ({
  ref: vi.fn(() => ({})),
  runTransaction: vi.fn(),
  get: vi.fn(),
  serverTimestamp: vi.fn(() => 1234),
}));
import { runTransaction, get } from 'firebase/database';
import { FirebaseTransport } from '../src/multiplayer/firebase-transport';
it('waiting departure retries against active metadata and closes the same room', async () => {
  const waiting: RoomMeta = {
    roomId: 'race',
    hostUid: 'h',
    seats: { '0': 'h', '1': 'a', '2': 'b' },
    status: 'waiting',
    rosterVersion: 2,
    createdAt: 1,
    updatedAt: 1,
    expiresAt: Date.now() + 999999,
  };
  let committed: RoomMeta | undefined;
  vi.mocked(runTransaction).mockImplementationOnce(async (_ref, updater) => {
    expect((updater(waiting) as RoomMeta).seats).toEqual({ '0': 'h', '2': 'b' });
    committed = updater({ ...waiting, status: 'active' }) as RoomMeta | undefined;
    return { committed: !!committed, snapshot: { val: () => committed } } as never;
  });
  const t = new FirebaseTransport({} as never, 'a', '0123', {
    state: () => {},
    error: () => {},
    connection: () => {},
  });
  Object.assign(t, { room: { meta: waiting } });
  await t.leave();
  expect(committed).toMatchObject({ roomId: 'race', status: 'closed', seats: waiting.seats });
});

it('cancelled host entry closes its created room before the first room snapshot arrives', async () => {
  const meta: RoomMeta = {
    roomId: 'pending',
    hostUid: 'h',
    seats: { '0': 'h' },
    status: 'waiting',
    rosterVersion: 0,
    createdAt: 1,
    updatedAt: 1,
    expiresAt: Date.now() + 999999,
  };
  vi.mocked(get).mockResolvedValueOnce({ val: () => meta } as never);
  let committed: RoomMeta | undefined;
  vi.mocked(runTransaction).mockImplementationOnce(async (_ref, updater) => {
    committed = updater(null) as RoomMeta | undefined;
    return { committed: !!committed, snapshot: { val: () => committed } } as never;
  });
  const t = new FirebaseTransport({} as never, 'h', '0123', {
    state: () => {},
    error: () => {},
    connection: () => {},
  });
  await t.leave();
  expect(committed).toMatchObject({ roomId: 'pending', status: 'closed' });
});
