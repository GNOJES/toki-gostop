import { expect, it } from 'vitest';
import { CARDS } from '../src/game-engine/cards';
import { settleRound, instantTransfers, transferDelta } from '../src/game-engine/settlement';
import { makeGostopFixture } from './helpers/gostop-fixture';
const pi = CARDS.filter((c) => c.isPi && c.piValue === 1);
function game(b = 1) {
  const s = makeGostopFixture({
    hands: [[], [], []],
    floor: [],
    draw: [],
    captured: [pi.slice(0, 15).map((c) => c.id), pi.slice(15, 15 + b).map((c) => c.id), []],
  });
  // Remaining cards are in the deck so these captures are the complete scoring input.
  return s;
}
it('charges each opponent independently and exempts zero pi', () => {
  const s = game(1);
  const r = settleRound(s, 0, 'STOP');
  expect(r.baseScore).toBe(6);
  expect(r.liabilities).toEqual([0n, 12n, 6n]);
  expect(r.roundDelta).toEqual([18n, -12n, -6n]);
  expect(settleRound(game(0), 0, 'STOP').liabilities).toEqual([0n, 6n, 6n]);
  expect(settleRound(game(5), 0, 'STOP').liabilities[1]).toBe(12n);
  expect(settleRound(game(6), 0, 'STOP').liabilities[1]).toBe(6n);
});
it('moves both debts to latest go declarer without an extra double', () => {
  const s = game();
  s.lastGo = 1;
  expect(settleRound(s, 0, 'STOP').roundDelta).toEqual([18n, -18n, 0n]);
  s.lastGo = 0;
  expect(settleRound(s, 0, 'STOP').roundDelta).toEqual([18n, -12n, -6n]);
});
it('keeps go additive two at three go and compounds nagari exactly', () => {
  const s = game(0);
  s.players[0].captured.pop(); // 14 pi => 5 points
  s.players[0].goCount = 3;
  expect(settleRound(s, 0, 'STOP').liabilities).toEqual([0n, 14n, 14n]);
  s.nagariStreak = 80;
  expect(settleRound(s, 0, 'STOP').liabilities[1]).toBe(14n * 2n ** 80n);
});
it('uses only nagari multiplier for special wins and leaves draws without final transfers', () => {
  const s = game();
  s.nagariStreak = 2;
  s.lastGo = 1;
  s.players[0].shakes = [1];
  s.players[0].goCount = 3;
  expect(settleRound(s, 0, 'CHONGTONG').roundDelta).toEqual([40n, -20n, -20n]);
  expect(settleRound(s, 0, 'THREE_PPUK').roundDelta).toEqual([24n, -12n, -12n]);
  expect(settleRound(s, null, 'NAGARI').transfers).toEqual([]);
});
it('retains instant ledger on draws and final settlement is pure and deterministic', () => {
  const s = game();
  s.transactions = [
    ...instantTransfers(s.gameId, 1, 0, 'OPENING_PPUK', 3n),
    ...instantTransfers(s.gameId, 2, 0, 'OPENING_PPUK', 6n),
    ...instantTransfers(s.gameId, 3, 0, 'OPENING_PPUK', 9n),
  ];
  expect(transferDelta(s.transactions)).toEqual([36n, -18n, -18n]);
  expect(settleRound(s, null, 'NAGARI').roundDelta).toEqual([36n, -18n, -18n]);
  const before = structuredClone(s);
  expect(settleRound(s, 0, 'STOP')).toEqual(settleRound(s, 0, 'STOP'));
  expect(s).toEqual(before);
});
it('charges gwangbak for rainy three gwang and stacks meongtta independently', () => {
  const s = game(0);
  s.players[0].captured = CARDS.filter((c) => c.isGwang && [1, 3, 12].includes(c.month));
  expect(settleRound(s, 0, 'STOP').baseScore).toBe(2);
  expect(settleRound(s, 0, 'STOP').liabilities).toEqual([0n, 4n, 4n]);
  s.players[1].captured = [CARDS.find((c) => c.isGwang && c.month === 8)!];
  expect(settleRound(s, 0, 'STOP').liabilities[1]).toBe(2n);
  s.players[0].captured = CARDS.filter((c) => c.isYeol).slice(0, 7);
  expect(settleRound(s, 0, 'STOP').commonMultiplier).toBe(2n);
  const kuk = CARDS.find((c) => c.specialType === 'KUKJIN')!;
  s.players[0].captured = [kuk, ...CARDS.filter((c) => c.isYeol && c.id !== kuk.id).slice(0, 6)];
  s.players[0].kukjinAsPi = true;
  expect(settleRound(s, 0, 'STOP').commonMultiplier).toBe(1n);
});
