import { isRequest } from './requests';
import { applyAction, createGame, projectState } from '../game-engine/engine';
import { seatForUid } from './room-membership';
import type { SeatId, SeatTuple } from '../game-engine/types';
import type { HostState, RoomData, RoomMessage, Request } from './types';
export { decodeState, encodeState } from './state-codec';
import { decodeState } from './state-codec';
export const ROOM_TTL = 24 * 60 * 60 * 1000;
export const emptyHostState = (): HostState => ({
  revision: 0,
  round: 0,
  game: null,
  events: [],
  stats: { wins: [0, 0, 0], points: [0n, 0n, 0n] },
  processed: [0, 0, 0],
  nextReady: [false, false, false],
  receipts: [{ seq: 0 }, { seq: 0 }, { seq: 0 }],
  appliedTransferIds: [],
  settledGameId: null,
});
export const connected = (room: RoomData, uid?: string): boolean =>
  !!uid && Object.values(room.players?.[uid]?.connections ?? {}).some(Boolean);
export const allConnected = (room: RoomData): boolean =>
  ([0, 1, 2] as const).every((id) => connected(room, room.meta.seats[id]));
export function readyToAct(room: RoomData, state: HostState) {
  return (
    !!state.game &&
    room.meta.status === 'active' &&
    allConnected(room) &&
    Object.values(room.meta.seats).every(
      (uid) =>
        room.players?.[uid]?.ready?.round === state.round &&
        room.players?.[uid]?.ready?.version === state.game!.stateVersion,
    )
  );
}
function settle(state: HostState) {
  const g = state.game;
  if (!g) return;
  const ids = new Set(state.appliedTransferIds);
  for (const t of g.transactions)
    if (!ids.has(t.id)) {
      state.stats.points[t.from] -= t.amount;
      state.stats.points[t.to] += t.amount;
      ids.add(t.id);
    }
  state.appliedTransferIds = [...ids];
  if (g.result && state.settledGameId !== g.gameId) {
    if (g.result.winner !== null) state.stats.wins[g.result.winner]++;
    state.settledGameId = g.gameId;
  }
}
export function startGame(state: HostState, room: RoomData, rng: () => number): HostState {
  if (state.game) return state;
  if (room.meta.status !== 'active' || !allConnected(room)) return state;
  const next = structuredClone(state);
  next.game = createGame({ gameId: `${room.meta.roomId}:1`, rng });
  next.round = 1;
  next.revision++;
  settle(next);
  return next;
}
export function processRequest(
  state: HostState,
  room: RoomData,
  request: Request,
  rng: () => number,
): HostState {
  const player = seatForUid(room.meta, request.uid);
  if (player === null) throw Error('참가 정보가 맞지 않아요.');
  if (!Number.isSafeInteger(request.sequence) || request.sequence < 1)
    throw Error('잘못된 요청이에요.');
  if (request.sequence !== state.processed[player] + 1) return state;
  const next = structuredClone(state);
  next.revision++;
  next.events = [];
  next.processed[player] = request.sequence;
  next.receipts[player] = { seq: request.sequence };
  try {
    if (!isRequest(request)) throw Error('잘못된 요청이에요.');
    if (room.meta.status !== 'active' || room.meta.expiresAt <= Date.now())
      throw Error('종료된 방이에요.');
    if (
      !next.game ||
      request.round !== next.round ||
      request.stateVersion !== next.game.stateVersion
    )
      throw Error('화면이 바뀌었어요. 다시 선택해주세요.');
    if (!allConnected(room)) throw Error('친구의 연결을 기다려주세요.');
    if (request.action.type === 'NEXT_ROUND') {
      if (next.game.phase !== 'FINISHED') throw Error('판이 끝난 뒤 다시 칠 수 있어요.');
      next.nextReady[player] = true;
      if (next.nextReady.every(Boolean)) {
        const previous = next.game;
        next.round++;
        next.game = createGame({
          gameId: `${room.meta.roomId}:${next.round}`,
          rng,
          dealer: previous.result?.winner ?? previous.dealer,
          nagariStreak: previous.result?.winner === null ? previous.nagariStreak + 1 : 0,
        });
        next.nextReady = [false, false, false];
        next.appliedTransferIds = [];
        next.settledGameId = null;
      }
    } else {
      if (!readyToAct(room, state)) throw Error('패 이동을 마칠 때까지 기다려주세요.');
      const result = applyAction(next.game, { ...request.action, player });
      next.game = result.nextState;
      next.events = result.events;
    }
    settle(next);
  } catch (error) {
    next.receipts[player].error = error instanceof Error ? error.message : '다시 선택해주세요.';
  }
  return next;
}
export function roomMessage(
  room: RoomData,
  code: string,
  uid: string,
  events: boolean,
): RoomMessage {
  const me = seatForUid(room.meta, uid);
  if (me === null) throw Error('참가 정보가 맞지 않아요.');
  const state = decodeState(room),
    ids = [0, 1, 2] as const;
  return {
    code,
    roomId: room.meta.roomId,
    me,
    nickname: room.players?.[uid]?.name ?? '참가자',
    names: ids.map(
      (id) => room.players?.[room.meta.seats[id] ?? '']?.name ?? '친구',
    ) as SeatTuple<string>,
    connected: ids.map((id) => connected(room, room.meta.seats[id])) as SeatTuple<boolean>,
    round: state.round,
    stats: state.stats,
    nextReady: state.nextReady,
    actionSequence: state.processed[me],
    canAct: room.meta.expiresAt > Date.now() && readyToAct(room, state),
    game: state.game ? projectState(state.game, me) : null,
    events: events ? state.events : [],
    transactions: state.game?.transactions ?? [],
    revision: state.revision,
    closed: room.meta.status === 'closed' || room.meta.expiresAt <= Date.now(),
    expiresAt: room.meta.expiresAt,
    disconnectedSince: null,
  };
}
