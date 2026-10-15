import type { HostState, RoomData } from './types';
import type { PointTransfer, GameState } from '../game-engine/types';
import { decodePoints } from '../game-engine/points';
import { assertInvariant } from '../game-engine/engine';
export function encodeState(state: HostState) {
  return {
    version: state.revision,
    data: JSON.stringify(state, (_, v) => (typeof v === 'bigint' ? v.toString() : v)),
  };
}
export function decodeState(room: Pick<RoomData, 'state'>): HostState {
  const s = JSON.parse(room.state.data);
  if (
    !s ||
    !Number.isSafeInteger(s.revision) ||
    s.revision < 0 ||
    s.revision !== room.state.version ||
    !Number.isSafeInteger(s.round) ||
    s.round < 0
  )
    throw Error('잘못된 방 버전');
  for (const k of ['processed', 'nextReady', 'receipts'])
    if (!Array.isArray(s[k]) || s[k].length !== 3) throw Error('잘못된 참가 상태');
  if (
    !s.processed.every((n: unknown) => Number.isSafeInteger(n) && (n as number) >= 0) ||
    !s.nextReady.every((n: unknown) => typeof n === 'boolean') ||
    !s.receipts.every((r: { seq: number }) => r && Number.isSafeInteger(r.seq) && r.seq >= 0)
  )
    throw Error('잘못된 요청 순번');
  if (
    !s.stats ||
    s.stats.points.length !== 3 ||
    s.stats.wins.length !== 3 ||
    !s.stats.wins.every((n: unknown) => Number.isSafeInteger(n) && (n as number) >= 0) ||
    !Array.isArray(s.appliedTransferIds) ||
    !s.appliedTransferIds.every((n: unknown) => typeof n === 'string')
  )
    throw Error('잘못된 통계');
  s.stats.points = s.stats.points.map(decodePoints);
  const transfers = (list: PointTransfer[]) => {
    if (!Array.isArray(list)) throw Error('잘못된 거래');
    for (const t of list) {
      t.amount = decodePoints(t.amount);
      if (
        typeof t.id !== 'string' ||
        ![0, 1, 2].includes(t.from) ||
        ![0, 1, 2].includes(t.to) ||
        t.from === t.to ||
        t.amount <= 0n ||
        !['INSTANT', 'FINAL'].includes(t.kind)
      )
        throw Error('잘못된 거래');
    }
  };
  if (s.game) {
    const g = s.game as GameState;
    if (
      typeof g.gameId !== 'string' ||
      (g.lastGo !== null && ![0, 1, 2].includes(g.lastGo)) ||
      ![0, 1, 2].includes(g.currentPlayer) ||
      !Number.isSafeInteger(g.nagariStreak) ||
      g.nagariStreak < 0
    )
      throw Error('잘못된 게임');
    transfers(g.transactions);
    if (g.result) {
      const r = g.result.settlement;
      r.commonMultiplier = decodePoints(r.commonMultiplier);
      if (r.liabilities.length !== 3 || r.roundDelta.length !== 3 || r.payerFor.length !== 3)
        throw Error('잘못된 정산');
      r.liabilities = r.liabilities.map(decodePoints) as typeof r.liabilities;
      r.roundDelta = r.roundDelta.map(decodePoints) as typeof r.roundDelta;
      transfers(r.transfers);
    }
    assertInvariant(g);
  }
  return s as HostState;
}
