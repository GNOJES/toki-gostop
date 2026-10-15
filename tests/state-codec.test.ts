import { it, expect } from 'vitest';
import { createGame } from '../src/game-engine/engine';
import { emptyHostState } from '../src/multiplayer/host';
import { encodeState, decodeState } from '../src/multiplayer/state-codec';
it('rejects corrupt card identities and invalid go ownership rather than starting over', () => {
  const h = emptyHostState();
  h.game = createGame({ seed: 3 });
  const saved = encodeState(h);
  expect(decodeState({ state: saved })).toEqual(h);
  const bad = JSON.parse(saved.data);
  bad.game.lastGo = 9;
  expect(() => decodeState({ state: { version: 0, data: JSON.stringify(bad) } })).toThrow();
  bad.game.lastGo = null;
  bad.game.players[0].hand[0] = bad.game.players[1].hand[0];
  expect(() => decodeState({ state: { version: 0, data: JSON.stringify(bad) } })).toThrow();
});
