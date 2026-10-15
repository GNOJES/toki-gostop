import type { GameResult, PointTransfer, SeatId, SeatTuple, EndReason } from '../game-engine/types';
import { decodePoints } from '../game-engine/points';
import { transferDelta } from '../game-engine/settlement';
export const HISTORY_KEY = 'toki-gostop.play-history.v1';
export interface PlayRecord {
  id: string;
  at: number;
  mode: 'single' | 'multi';
  names: SeatTuple<string>;
  me: SeatId;
  winner: SeatId | null;
  reason: EndReason;
  ruleVersion: string;
  delta: SeatTuple<string>;
}
export interface InstantRecord {
  gameId: string;
  at: number;
  mode: 'single' | 'multi';
  names: SeatTuple<string>;
  me: SeatId;
  transfer: Omit<PointTransfer, 'amount'> & { amount: string };
}
export interface PlayHistory {
  solo: { wins: number; losses: number; draws: number; points: string };
  recent: PlayRecord[];
  instant: InstantRecord[];
}
export interface ProgressInput {
  gameId: string;
  mode: 'single' | 'multi';
  names: SeatTuple<string>;
  me: SeatId;
  transactions: PointTransfer[];
  result: GameResult | null;
  at?: number;
}
export const emptyHistory = (): PlayHistory => ({
  solo: { wins: 0, losses: 0, draws: 0, points: '0' },
  recent: [],
  instant: [],
});
export function parseHistory(raw: string | null): PlayHistory {
  try {
    const h = JSON.parse(raw ?? 'null');
    if (!h?.solo || !Array.isArray(h.recent)) return emptyHistory();
    if (
      !['wins', 'losses', 'draws'].every((k) => Number.isSafeInteger(h.solo[k]) && h.solo[k] >= 0)
    )
      return emptyHistory();
    decodePoints(h.solo.points);
    const recent = h.recent
      .filter((r: PlayRecord) => {
        try {
          return (
            typeof r.id === 'string' &&
            Number.isSafeInteger(r.at) &&
            r.at >= 0 &&
            r.at <= 8640000000000000 &&
            ['single', 'multi'].includes(r.mode) &&
            [0, 1, 2].includes(r.me) &&
            (r.winner === null || [0, 1, 2].includes(r.winner)) &&
            ['STOP', 'NAGARI', 'CHONGTONG', 'THREE_PPUK'].includes(r.reason) &&
            typeof r.ruleVersion === 'string' &&
            r.names.length === 3 &&
            r.names.every((n) => typeof n === 'string') &&
            r.delta.length === 3 &&
            r.delta.every((n) => typeof decodePoints(n) === 'bigint')
          );
        } catch {
          return false;
        }
      })
      .slice(0, 100);
    const instant = (Array.isArray(h.instant) ? h.instant : []).filter((r: InstantRecord) => {
      try {
        return (
          typeof r.gameId === 'string' &&
          Number.isSafeInteger(r.at) &&
          r.at >= 0 &&
          r.at <= 8640000000000000 &&
          ['single', 'multi'].includes(r.mode) &&
          [0, 1, 2].includes(r.me) &&
          r.names.length === 3 &&
          r.names.every((n) => typeof n === 'string') &&
          typeof r.transfer.id === 'string' &&
          r.transfer.kind === 'INSTANT' &&
          [0, 1, 2].includes(r.transfer.from) &&
          [0, 1, 2].includes(r.transfer.to) &&
          r.transfer.from !== r.transfer.to &&
          decodePoints(r.transfer.amount) > 0n
        );
      } catch {
        return false;
      }
    });
    return { solo: { ...h.solo }, recent, instant };
  } catch {
    return emptyHistory();
  }
}
export function applyProgress(
  history: PlayHistory,
  input: ProgressInput,
  seen: Set<string>,
  done: Set<string>,
): PlayHistory {
  const h: PlayHistory = {
    solo: { ...history.solo },
    recent: [...history.recent],
    instant: [...history.instant],
  };
  let points = BigInt(h.solo.points);
  for (const t of input.transactions) {
    if (seen.has(t.id)) continue;
    if (t.amount <= 0n || t.from === t.to) throw Error('Invalid transfer');
    seen.add(t.id);
    if (t.kind === 'INSTANT')
      h.instant.unshift({
        gameId: input.gameId,
        at: input.at ?? Date.now(),
        mode: input.mode,
        names: [...input.names],
        me: input.me,
        transfer: { ...t, amount: t.amount.toString() },
      });
    if (input.mode === 'single') {
      if (t.to === input.me) points += t.amount;
      if (t.from === input.me) points -= t.amount;
    }
  }
  h.solo.points = points.toString();
  if (input.result && !done.has(input.gameId)) {
    done.add(input.gameId);
    const r = input.result;
    if (input.mode === 'single')
      h.solo[r.winner === null ? 'draws' : r.winner === input.me ? 'wins' : 'losses']++;
    h.recent.unshift({
      id: input.gameId,
      at: input.at ?? Date.now(),
      mode: input.mode,
      names: [...input.names],
      me: input.me,
      winner: r.winner,
      reason: r.reason,
      ruleVersion: 'gostop-v1',
      delta: transferDelta(input.transactions).map((n) => n.toString()) as SeatTuple<string>,
    });
    h.recent = h.recent.slice(0, 100);
  }
  return h;
}
export const resetSolo = (h: PlayHistory): PlayHistory => ({
  solo: emptyHistory().solo,
  recent: h.recent.filter((r) => r.mode !== 'single'),
  instant: h.instant.filter((r) => r.mode !== 'single'),
});
