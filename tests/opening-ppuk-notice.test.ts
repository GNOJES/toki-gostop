import { expect, it } from 'vitest';
import { applyAction, projectState } from '../src/game-engine/engine';
import { createFixture } from '../src/game-engine/fixtures';
import { instantTransfers } from '../src/game-engine/settlement';
import { openingPpukEffect } from '../src/lib/game-presenter';

it.each([
  [0, '첫뻑!', '상대에게 3점씩 · 총 6점 획득'],
  [1, '2연뻑!', '상대에게 6점씩 · 총 12점 추가'],
  [2, '3연뻑!', '상대에게 9점씩 · 총 18점 추가'],
] as const)(
  'shows only the new opening ppuk payment after %i earlier ppuks',
  (streak, label, detail) => {
    const s = createFixture('뻑과 보너스');
    s.players[0].openingPpukStreak = streak;
    s.players[0].ppukCount = streak;
    s.deck.push(...s.players[0].hand.splice(7 - streak));
    s.players[0].turnsRemaining = 7 - streak;
    s.transactions = instantTransfers(s.gameId, 0, 0, 'OPENING_PPUK', 3n);
    const before = projectState(s, 0);
    const result = applyAction(s, { type: 'PLAY_CARD', player: 0, cardId: 'm1-2' });
    const next = projectState(result.nextState, 0);
    const event = result.events.find((e) => e.type === 'PPUK_OCCURRED')!;
    expect(openingPpukEffect(before, next, event)).toEqual({ label, detail, player: 0 });
    expect(openingPpukEffect(next, next, event)).toBeNull();
    expect(openingPpukEffect(before, next, { type: 'TURN_ENDED', player: 0 })).toBeNull();
  },
);

it('does not reuse an old opening payment for a later ordinary ppuk', () => {
  const s = createFixture('뻑과 보너스');
  s.deck.push(...s.players[0].hand.splice(6));
  s.players[0].turnsRemaining = 6;
  s.transactions = instantTransfers(s.gameId, 0, 0, 'OPENING_PPUK', 3n);
  const before = projectState(s, 0);
  const result = applyAction(s, { type: 'PLAY_CARD', player: 0, cardId: 'm1-2' });
  expect(
    openingPpukEffect(
      before,
      projectState(result.nextState, 0),
      result.events.find((e) => e.type === 'PPUK_OCCURRED')!,
    ),
  ).toBeNull();
});
