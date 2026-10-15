import { calculateScore } from './score';
import { otherSeats } from './seats';
import type {
  EndReason,
  GameState,
  PointTransfer,
  Points,
  RoundSettlement,
  SeatId,
  SeatTuple,
} from './types';
export function transferDelta(transfers: readonly PointTransfer[]): SeatTuple<Points> {
  const delta: SeatTuple<Points> = [0n, 0n, 0n];
  for (const t of transfers) {
    delta[t.from] -= t.amount;
    delta[t.to] += t.amount;
  }
  return delta;
}
export function instantTransfers(
  gameId: string,
  stateVersion: number,
  to: SeatId,
  reason: 'OPENING_PPUK' | 'OPENING_TTADAK',
  perOpponent: Points,
): PointTransfer[] {
  return otherSeats(to).map((from) => ({
    id: `${gameId}:instant:${stateVersion}:${reason}:${from}`,
    from,
    to,
    amount: perOpponent,
    kind: 'INSTANT',
    reason,
  }));
}
export function settleRound(
  state: GameState,
  winner: SeatId | null,
  reason: EndReason,
): RoundSettlement {
  const liabilities: SeatTuple<Points> = [0n, 0n, 0n],
    payerFor: SeatTuple<SeatId | null> = [null, null, null];
  const transfers: PointTransfer[] = [];
  let baseScore = 0,
    commonMultiplier = 1n;
  if (winner !== null) {
    const p = state.players[winner],
      score = calculateScore(p);
    const special = reason !== 'STOP';
    baseScore = special ? (reason === 'CHONGTONG' ? 5 : 3) : score.baseScore;
    const exponent = special
      ? state.nagariStreak
      : Math.max(p.goCount - 2, 0) +
        p.shakes.length +
        p.bombs +
        (score.yeolCount >= 7 ? 1 : 0) +
        state.nagariStreak;
    commonMultiplier = 2n ** BigInt(exponent);
    const common =
      (BigInt(baseScore) + BigInt(special ? 0 : Math.min(p.goCount, 2))) * commonMultiplier;
    for (const seat of otherSeats(winner)) {
      const loser = calculateScore(state.players[seat]);
      const pi =
        !special && score.piScore > 0 && loser.piCount >= 1 && loser.piCount <= 5 ? 2n : 1n;
      const gwang =
        !special && score.gwangScore > 0 && !state.players[seat].captured.some((c) => c.isGwang)
          ? 2n
          : 1n;
      liabilities[seat] = common * pi * gwang;
      payerFor[seat] =
        !special && state.lastGo !== null && state.lastGo !== winner ? state.lastGo : seat;
      transfers.push({
        id: `${state.gameId}:final:${seat}`,
        from: payerFor[seat]!,
        to: winner,
        amount: liabilities[seat],
        kind: 'FINAL',
        reason,
      });
    }
  }
  return {
    baseScore,
    commonMultiplier,
    liabilities,
    payerFor,
    transfers,
    roundDelta: transferDelta([
      ...state.transactions.filter((t) => t.kind === 'INSTANT'),
      ...transfers,
    ]),
  };
}
