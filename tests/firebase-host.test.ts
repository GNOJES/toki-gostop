import { it, expect } from 'vitest';
import {
  emptyHostState,
  encodeState,
  decodeState,
  startGame,
  processRequest,
  roomMessage,
  readyToAct,
} from '../src/multiplayer/host';
import { seededRandom } from '../src/game-engine/cards';
import { chooseAction } from '../src/game-engine/ai';
import type { RoomData } from '../src/multiplayer/types';
function setup() {
  const room: RoomData = {
    meta: {
      hostUid: 'h',
      seats: { '0': 'h', '1': 'a', '2': 'b' },
      rosterVersion: 2,
      status: 'active',
      roomId: 'r',
      createdAt: 1,
      updatedAt: 1,
      expiresAt: Date.now() + 999999,
    },
    players: {
      h: { name: 'H', connections: { x: true } },
      a: { name: 'A', connections: { x: true } },
      b: { name: 'B', connections: { x: true } },
    },
    state: encodeState(emptyHostState()),
  };
  let state = startGame(emptyHostState(), room, seededRandom(12));
  room.state = encodeState(state);
  for (const p of Object.values(room.players!))
    p.ready = { round: state.round, version: state.game!.stateVersion };
  return { room, state };
}
it('initializes once and maps all three private views', () => {
  const { room, state } = setup();
  expect(startGame(state, room, seededRandom(1))).toBe(state);
  expect(roomMessage(room, '1234', 'b', false).me).toBe(2);
  expect(readyToAct(room, state)).toBe(true);
  expect(() => roomMessage(room, '1234', 'x', false)).toThrow();
  delete room.players!.b.ready;
  expect(readyToAct(room, state)).toBe(false);
});
it('authoritatively maps sender UID, deduplicates and consumes rejected requests', () => {
  const { room, state } = setup();
  const p = state.game!.currentPlayer,
    uid = room.meta.seats[p]!;
  const action = chooseAction(roomMessage(room, '1234', uid, false).game!, p);
  const req = {
    round: 1,
    sequence: 1,
    stateVersion: 0,
    uid,
    createdAt: 1,
    action: { ...action, player: ((p + 1) % 3) as 0 | 1 | 2 },
  };
  const next = processRequest(state, room, req, seededRandom(2));
  expect(next.game!.stateVersion).toBe(1);
  expect(processRequest(next, room, req, seededRandom(2))).toBe(next);
  const invalid = processRequest(next, room, { ...req, sequence: 2 }, seededRandom(2));
  expect(invalid.receipts[p].error).toBeTruthy();
  expect(invalid.game).toEqual(next.game);
});
it('codec round trips large signed totals and rejects invalid points', () => {
  const { room, state } = setup();
  state.stats.points = [2n ** 80n, -(2n ** 80n), 0n];
  room.state = encodeState(state);
  expect(decodeState(room)).toEqual(state);
  expect(room.state.data).toContain('1208925819614629174706176');
  room.state.data = room.state.data.replace('-1208925819614629174706176', '1.5');
  expect(() => decodeState(room)).toThrow();
});
it('next round requires all votes and accumulates consecutive nagari', () => {
  let { room, state } = setup();
  const dealer = state.game!.dealer;
  state.game!.phase = 'FINISHED';
  state.game!.result = {
    winner: null,
    reason: 'NAGARI',
    settlement: {
      baseScore: 0,
      commonMultiplier: 1n,
      liabilities: [0n, 0n, 0n],
      payerFor: [null, null, null],
      transfers: [],
      roundDelta: [0n, 0n, 0n],
    },
  };
  for (const [p, uid] of ['h', 'a', 'b'].entries()) {
    state = processRequest(
      state,
      room,
      { uid, round: 1, sequence: 1, stateVersion: 0, createdAt: 1, action: { type: 'NEXT_ROUND' } },
      seededRandom(1),
    );
    expect(state.round).toBe(p === 2 ? 2 : 1);
  }
  expect(state.game!.nagariStreak).toBe(1);
  expect(state.game!.dealer).toBe(dealer);
});
