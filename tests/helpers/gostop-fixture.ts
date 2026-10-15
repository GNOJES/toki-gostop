import { CARDS } from '../../src/game-engine/cards';
import type { GameState, PlayerState, SeatId, SeatTuple } from '../../src/game-engine/types';
export const makePlayer = (): PlayerState => ({
  hand: [],
  captured: [],
  goCount: 0,
  goAtScore: 0,
  shakes: [],
  bombs: 0,
  bombPasses: 0,
  turnsRemaining: 0,
  ppukCount: 0,
  openingPpukStreak: 0,
  emptyStreak: 0,
  kukjinAsPi: false,
});
export function makeGostopFixture(input: {
  hands: SeatTuple<string[]>;
  floor: string[];
  draw: string[];
  captured?: SeatTuple<string[]>;
  currentPlayer?: SeatId;
}): GameState {
  const cards = (ids: string[]) =>
    ids.map((id) => {
      const c = CARDS.find((c) => c.id === id);
      if (!c) throw Error(id);
      return c;
    });
  const players = input.hands.map((h, i) => ({
    ...makePlayer(),
    hand: cards(h),
    turnsRemaining: h.length,
    captured: cards(input.captured?.[i] ?? []),
  })) as GameState['players'];
  const ids = [
    ...input.hands.flat(),
    ...input.floor,
    ...input.draw,
    ...(input.captured ?? []).flat(),
  ];
  if (new Set(ids).size !== ids.length) throw Error('Duplicate fixture card');
  return {
    players,
    floor: cards(input.floor),
    deck: [...cards(input.draw), ...CARDS.filter((c) => !ids.includes(c.id))],
    gameId: 'fixture',
    transactions: [],
    currentPlayer: input.currentPlayer ?? 0,
    dealer: 0,
    dealerDraw: [1, 2, 3],
    phase: 'PLAY',
    turn: null,
    ppukOwners: {},
    bonusAttachments: {},
    lastGo: null,
    nagariStreak: 0,
    stateVersion: 0,
    turnNumber: 1,
    result: null,
  };
}
