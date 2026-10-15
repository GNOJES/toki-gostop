import { expect, it } from 'vitest';
import { createGame, applyAction, assertInvariant, projectState } from '../src/game-engine/engine';
import { CARDS } from '../src/game-engine/cards';
import { makeGostopFixture } from './helpers/gostop-fixture';
it.each([0, 1, 2] as const)(
  'deals seven per player with dealer %i and conserves fifty cards',
  (dealer) => {
    for (let seed = 1; seed <= 40; seed++) {
      const s = createGame({ seed, dealer, gameId: 'test' });
      expect(s.players.map((p) => p.hand.length)).toEqual([7, 7, 7]);
      expect(s.floor).toHaveLength(6);
      expect(s.floor.some((c) => c.isBonus)).toBe(false);
      assertInvariant(s);
    }
  },
);
it('does not reveal either other hand or the deck in projections', () => {
  const s = createGame({ seed: 1 });
  for (const seat of [0, 1, 2] as const) {
    const v = projectState(s, seat);
    expect(v.hand).toEqual(s.players[seat].hand);
    expect(v.players).toHaveLength(3);
    expect(v).not.toHaveProperty('deck');
    expect(v.players.every((p) => !('hand' in p))).toBe(true);
  }
});
it('redraws only lowest tied seats to select first dealer', () => {
  const seq = [5, 5, 10, 3, 4].map((x) => (x - 0.5) / 12);
  let i = 0;
  const s = createGame({
    rng: () => seq[i++] ?? 0.7,
    deck: CARDS.filter((c) => !c.isBonus)
      .sort((a, b) => Number(a.id.split('-')[1]) - Number(b.id.split('-')[1]))
      .concat(CARDS.filter((c) => c.isBonus)),
  });
  expect(s.dealer).toBe(0);
  expect(s.dealerDraw).toEqual([3, 4, 10]);
});
it('pays first ppuk immediately in three-player zero sum ledger', () => {
  const s = makeGostopFixture({
    hands: [['m1-0', 'm2-0'], [], []],
    floor: ['m1-1'],
    draw: ['m1-2'],
  });
  s.players[0].turnsRemaining = 7;
  // Add legal remaining hands to represent the opening turn.
  const extra = s.deck.splice(1, 5);
  s.players[0].hand.push(...extra);
  const n = applyAction(s, { type: 'PLAY_CARD', player: 0, cardId: 'm1-0' }).nextState;
  expect(n.transactions.map((t) => [t.from, t.to, t.amount])).toEqual([
    [1, 0, 3n],
    [2, 0, 3n],
  ]);
  assertInvariant(n);
});
it('last turn does not create ppuk and invalid actions preserve input', () => {
  const s = makeGostopFixture({ hands: [['m1-0'], [], []], floor: ['m1-1'], draw: ['m1-2'] });
  const before = structuredClone(s);
  expect(() => applyAction(s, { type: 'PLAY_CARD', player: 1, cardId: 'm1-0' })).toThrow();
  expect(s).toEqual(before);
  const n = applyAction(s, { type: 'PLAY_CARD', player: 0, cardId: 'm1-0' }).nextState;
  expect(n.players[0].ppukCount).toBe(0);
  expect(n.players[0].captured.map((c) => c.id)).toContain('m1-1');
  expect(n.floor.map((c) => c.id)).toContain('m1-2');
});
it('does not award a heodang win for five empty turns', () => {
  const s = makeGostopFixture({ hands: [['m1-0', 'm2-0'], [], []], floor: [], draw: ['m3-0'] });
  s.players[0].emptyStreak = 4;
  const n = applyAction(s, { type: 'PLAY_CARD', player: 0, cardId: 'm1-0' }).nextState;
  expect(n.phase).not.toBe('FINISHED');
  expect(n.players[0].emptyStreak).toBe(5);
});
