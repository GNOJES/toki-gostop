import { expect, it } from 'vitest';
import { applyAction, assertInvariant } from '../src/game-engine/engine';
import { makeGostopFixture } from './helpers/gostop-fixture';
function selfppuk() {
  const s = makeGostopFixture({
    hands: [['m1-0', 'm2-0'], [], []],
    floor: ['m1-1', 'm1-2', 'm1-3'],
    draw: ['m3-0'],
    captured: [[], ['m4-2'], ['m11-1']],
  });
  s.ppukOwners[1] = 0;
  return s;
}
it('takes self ppuk two pi from each opponent using value rather than card count', () => {
  const s = selfppuk();
  const { nextState: n, events } = applyAction(s, { type: 'PLAY_CARD', player: 0, cardId: 'm1-0' });
  expect(n.players[1].captured).toHaveLength(0);
  expect(n.players[2].captured).toHaveLength(0);
  expect(
    events
      .filter((e) => e.type === 'PI_TRANSFERRED')
      .map((e) => [e.from, e.to, e.requestedPi, e.actualPi]),
  ).toEqual([
    [1, 0, 2, 1],
    [2, 0, 2, 2],
  ]);
  assertInvariant(n);
});
it('uses single pi then double pi when two requested and leaves empty opponents alone', () => {
  const s = selfppuk();
  const card = s.deck.find((c) => c.id === 'm5-2')!;
  s.deck = s.deck.filter((c) => c.id !== card.id);
  s.players[2].captured.unshift(card);
  const { events } = applyAction(s, { type: 'PLAY_CARD', player: 0, cardId: 'm1-0' });
  expect(events.filter((e) => e.type === 'PI_TRANSFERRED').map((e) => e.actualPi)).toEqual([1, 3]);
});
it('takes one pi from both opponents for another persons ppuk', () => {
  const s = selfppuk();
  s.ppukOwners[1] = 2;
  const { events } = applyAction(s, { type: 'PLAY_CARD', player: 0, cardId: 'm1-0' });
  expect(
    events
      .filter((e) => e.type === 'PI_TRANSFERRED')
      .map((e) => [e.from, e.requestedPi, e.actualPi]),
  ).toEqual([
    [1, 1, 1],
    [2, 1, 2],
  ]);
});
