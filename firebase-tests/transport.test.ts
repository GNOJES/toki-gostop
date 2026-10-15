import { beforeAll, afterAll, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { initializeApp, deleteApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import {
  connectDatabaseEmulator,
  getDatabase,
  goOffline,
  goOnline,
  ref,
  get,
} from 'firebase/database';
import { FirebaseTransport } from '../src/multiplayer/firebase-transport';
import { chooseAction } from '../src/game-engine/ai';
import type { RoomMessage } from '../src/multiplayer/types';
let env: RulesTestEnvironment;
const apps: FirebaseApp[] = [],
  ts: FirebaseTransport[] = [];
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-toki-gostop',
    database: {
      host: '127.0.0.1',
      port: 9100,
      rules: await readFile('database.rules.json', 'utf8'),
    },
  });
  await env.clearDatabase();
});
afterAll(async () => {
  ts.forEach((t) => t.dispose());
  await Promise.all(apps.map(deleteApp));
  await env.cleanup();
});
async function user() {
  const app = initializeApp(
    {
      apiKey: 'demo-key',
      projectId: 'demo-toki-gostop',
      databaseURL: 'https://demo-toki-gostop-default-rtdb.firebaseio.com',
    },
    crypto.randomUUID(),
  );
  apps.push(app);
  const auth = getAuth(app),
    db = getDatabase(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9199', { disableWarnings: true });
  connectDatabaseEmulator(db, '127.0.0.1', 9100);
  const uid = (await signInAnonymously(auth)).user.uid;
  return { auth, db, uid };
}
it('real Auth three seats automatically start, recover, finish, vote next round and close with preserved state', async () => {
  const users = await Promise.all([user(), user(), user(), user()]);
  const messages: (RoomMessage | undefined)[] = [];
  const errors: string[] = [];
  const players: FirebaseTransport[] = [];
  async function open(i: number, code?: string, resume = false) {
    let t: FirebaseTransport | undefined;
    t = await FirebaseTransport.open(
      {
        state: (m) => {
          messages[i] = m;
          if (m.game)
            queueMicrotask(() => void t?.ready(m.round, m.game!.stateVersion).catch(() => {}));
        },
        connection: () => {},
        error: (e) => errors.push(e),
      },
      code,
      `참가자${i}`,
      resume,
      async () => users[i],
    );
    ts.push(t);
    players[i] = t;
    return t;
  }
  const host = await open(0);
  await open(1, host.code);
  await expect.poll(() => messages[0]?.game ?? null).toBeNull();
  await open(2, host.code);
  await expect
    .poll(
      () => messages.slice(0, 3).every((m) => m?.canAct) && messages.filter(Boolean).length === 3,
    )
    .toBe(true);
  expect(messages.map((m) => m?.me)).toEqual([0, 1, 2]);
  await expect(open(3, host.code)).rejects.toThrow();
  goOffline(users[2].db);
  await expect.poll(() => messages[0]?.connected[2]).toBe(false);
  expect(messages[0]?.canAct).toBe(false);
  goOnline(users[2].db);
  await expect.poll(() => messages.slice(0, 3).every((m) => m?.canAct)).toBe(true);
  // Guest refresh resumes the same seat without reinitializing or advancing the round.
  players[2].dispose();
  await open(2, host.code, true);
  await expect.poll(() => messages[2]?.canAct).toBe(true);
  expect(messages[2]?.me).toBe(2);
  let steps = 0;
  while (messages[0]?.game?.phase !== 'FINISHED' && steps++ < 150) {
    await expect
      .poll(() =>
        messages
          .slice(0, 3)
          .every((m) => m?.canAct && m.game?.stateVersion === messages[0]?.game?.stateVersion),
      )
      .toBe(true);
    if (String(messages[0]!.game!.phase) === 'FINISHED') break;
    const current = messages[0]!.game!.currentPlayer,
      m = messages[current]!;
    const action = chooseAction(m.game!, current, 'easy');
    await players[current].action({
      round: m.round,
      sequence: m.actionSequence + 1,
      stateVersion: m.game!.stateVersion,
      action,
    });
  }
  expect(messages[0]!.game!.phase).toBe('FINISHED');
  await expect.poll(() => new Set(messages.slice(0, 3).map((m) => m?.revision)).size).toBe(1);
  const points = messages[0]!.stats.points;
  expect(points.reduce((n, p) => n + p, 0n)).toBe(0n);
  for (let i = 0; i < 3; i++) {
    const m = messages[i]!;
    await players[i].nextRound(m.round, m.game!.stateVersion, m.actionSequence + 1);
    if (i < 2) expect(messages[0]!.round).toBe(1);
  }
  await expect.poll(() => messages[0]?.round).toBe(2);
  await players[1].leave();
  await expect.poll(() => messages[0]?.closed).toBe(true);
  expect((await get(ref(users[0].db, `rooms/${host.code}/state`))).exists()).toBe(true);
  expect(errors).toEqual([]);
}, 120000);
it('waiting guest can leave and another anonymous user takes the free seat', async () => {
  const users = await Promise.all([user(), user(), user()]);
  const msgs: (RoomMessage | undefined)[] = [];
  const open = async (i: number, code?: string) => {
    const t = await FirebaseTransport.open(
      { state: (m) => (msgs[i] = m), connection: () => {}, error: () => {} },
      code,
      `P${i}`,
      false,
      async () => users[i],
    );
    ts.push(t);
    return t;
  };
  const h = await open(0),
    a = await open(1, h.code);
  await expect.poll(() => msgs[1]?.me).toBe(1);
  await a.leave();
  const b = await open(2, h.code);
  await expect.poll(() => msgs[2]?.me).toBe(1);
  expect(msgs[0]?.closed).toBe(false);
  await h.leave();
  b.dispose();
});
