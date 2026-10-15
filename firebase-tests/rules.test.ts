import { readFile } from 'node:fs/promises';
import { beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { get, ref, set, update, runTransaction, remove } from 'firebase/database';
import { emptyHostState, encodeState } from '../src/multiplayer/host';
import { claimSeat } from '../src/multiplayer/room-membership';
let env: RulesTestEnvironment;
const code = '0123';
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-toki-gostop',
    database: {
      host: '127.0.0.1',
      port: 9100,
      rules: await readFile('database.rules.json', 'utf8'),
    },
  });
});
beforeEach(() => env.clearDatabase());
afterAll(() => env.cleanup());
const db = (uid: string) => env.authenticatedContext(uid).database();
async function create() {
  const d = db('h'),
    now = Date.now(),
    expiresAt = now + 86400000;
  await set(ref(d, 'roomOwners/h'), { code, createdAt: now, expiresAt });
  await set(ref(d, `rooms/${code}`), {
    meta: {
      hostUid: 'h',
      seats: { '0': 'h' },
      rosterVersion: 0,
      roomId: 'room-1',
      status: 'waiting',
      createdAt: now,
      updatedAt: now,
      expiresAt,
    },
    players: { h: { name: 'H', connections: { x: true } } },
    state: encodeState(emptyHostState()),
  });
  return d;
}
async function join(uid: string) {
  const initial = (await get(ref(db(uid), `rooms/${code}/meta`))).val();
  await runTransaction(ref(db(uid), `rooms/${code}/meta`), (m) => claimSeat(m ?? initial, uid), {
    applyLocally: false,
  });
  await set(ref(db(uid), `rooms/${code}/players/${uid}`), { name: uid, connections: { x: true } });
}
it('denies unauthenticated access and protects room lists and outsider state', async () => {
  await create();
  const no = env.unauthenticatedContext().database();
  await assertFails(get(ref(no, `rooms/${code}/meta`)));
  await assertFails(get(ref(db('a'), 'rooms')));
  await assertFails(get(ref(db('a'), `rooms/${code}`)));
  await assertSucceeds(get(ref(db('a'), `rooms/${code}/meta`)));
});
it('assigns simultaneous distinct guests, no duplicate UID or fourth participant', async () => {
  await create();
  await Promise.all([join('a'), join('b')]);
  const m = (await get(ref(db('h'), `rooms/${code}/meta`))).val();
  expect(new Set(Object.values(m.seats)).size).toBe(3);
  await runTransaction(ref(db('a'), `rooms/${code}/meta`), (m) =>
    m ? claimSeat(m, 'a') : undefined,
  );
  expect((await get(ref(db('h'), `rooms/${code}/meta/rosterVersion`))).val()).toBe(2);
  await expect(join('c')).rejects.toThrow();
});
it('blocks parent meta writes from taking other seats or changing immutable fields', async () => {
  await create();
  await join('a');
  const d = db('a'),
    base = `rooms/${code}/meta`;
  const m = (await get(ref(d, base))).val();
  await assertFails(
    set(ref(d, base), { ...m, seats: { '0': 'a', '1': 'h' }, rosterVersion: m.rosterVersion + 1 }),
  );
  await assertFails(update(ref(d, base), { expiresAt: Date.now() + 50000 }));
  await assertFails(update(ref(d, base), { hostUid: 'a' }));
  await assertFails(update(ref(d, base), { extra: 'x' }));
});
it('permits waiting guest leave and prevents active seat changes', async () => {
  const h = await create();
  await join('a');
  const prior = (await get(ref(db('a'), `rooms/${code}/meta`))).val();
  await runTransaction(ref(db('a'), `rooms/${code}/meta`), (m) => ({
    ...(m ?? prior),
    seats: { '0': 'h' },
    rosterVersion: (m ?? prior).rosterVersion + 1,
  }));
  await join('b');
  await join('c');
  await assertSucceeds(update(ref(h, `rooms/${code}/meta`), { status: 'active' }));
  const m = (await get(ref(h, `rooms/${code}/meta`))).val();
  await assertFails(
    set(ref(db('b'), `rooms/${code}/meta`), {
      ...m,
      seats: { '0': 'h', '2': 'c' },
      rosterVersion: m.rosterVersion + 1,
    }),
  );
});
it('only host commits state and each member only owns their own actions and presence', async () => {
  const h = await create();
  await join('a');
  await join('b');
  await update(ref(h, `rooms/${code}/meta`), { status: 'active' });
  const action = {
    uid: 'b',
    round: 1,
    sequence: 1,
    stateVersion: 0,
    createdAt: Date.now(),
    action: { type: 'GO', player: 2 },
  };
  await assertSucceeds(set(ref(db('b'), `rooms/${code}/actions/b/pending`), action));
  await assertFails(
    set(ref(db('a'), `rooms/${code}/actions/b/pending`), { ...action, sequence: 2 }),
  );
  await assertFails(set(ref(db('a'), `rooms/${code}/players/b/name`), 'hacked'));
  await assertFails(set(ref(db('a'), `rooms/${code}/state`), { version: 1, data: '{}' }));
  const state = emptyHostState();
  state.revision = 1;
  await assertSucceeds(set(ref(h, `rooms/${code}/state`), encodeState(state)));
  await assertFails(
    set(ref(db('b'), `rooms/${code}/actions/b/pending`), { ...action, sequence: 1.5 }),
  );
  await assertFails(set(ref(db('b'), `rooms/${code}/actions/b/other`), action));
  await assertFails(
    set(ref(db('b'), `rooms/${code}/actions/b/pending`), { ...action, sequence: 2, extra: 'bad' }),
  );
});
it('closure is terminal and preserves final snapshot for participants', async () => {
  const h = await create();
  await join('a');
  await join('b');
  await update(ref(h, `rooms/${code}/meta`), { status: 'active' });
  await assertSucceeds(update(ref(db('a'), `rooms/${code}/meta`), { status: 'closed' }));
  await assertFails(update(ref(h, `rooms/${code}/meta`), { status: 'active' }));
  await assertSucceeds(get(ref(db('b'), `rooms/${code}/state`)));
  await assertFails(set(ref(h, `rooms/${code}/state`), { version: 1, data: '{}' }));
});
it('rejects duplicate live owner rooms and unreserved room creation', async () => {
  const h = await create();
  await assertFails(
    set(ref(h, 'roomOwners/h'), {
      code: '9999',
      createdAt: Date.now(),
      expiresAt: Date.now() + 86400000,
    }),
  );
  const snap = (await get(ref(h, `rooms/${code}`))).val();
  await assertFails(set(ref(db('a'), 'rooms/9999'), snap));
});
it('expired rooms can be reclaimed but not joined', async () => {
  await create();
  await env.withSecurityRulesDisabled(async (c) => {
    await update(ref(c.database(), `rooms/${code}/meta`), { expiresAt: Date.now() - 1 });
  });
  await expect(join('a')).rejects.toThrow();
  await assertSucceeds(remove(ref(db('a'), `rooms/${code}`)));
});
it('rejects a raw expired meta join even when the client validator is bypassed', async () => {
  await create();
  await env.withSecurityRulesDisabled(async (c) => {
    await update(ref(c.database(), `rooms/${code}/meta`), { expiresAt: Date.now() - 1 });
  });
  await assertFails(
    update(ref(db('a'), `rooms/${code}/meta`), { 'seats/1': 'a', rosterVersion: 1 }),
  );
});
