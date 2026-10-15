'use client';
import { useRef, useCallback, useEffect } from 'react';
import { createGame, applyAction, projectState } from '../game-engine/engine';
import { chooseAction, type Difficulty } from '../game-engine/ai';
import type { GameState, GameAction, GameView } from '../game-engine/types';
/** Owns the local authority. Multiplayer authority remains the host transport. */
export function useGameSession() {
  const logical = useRef<GameState | null>(null);
  const createSolo = useCallback((options: Parameters<typeof createGame>[0]) => {
    const s = createGame(options);
    logical.current = s;
    return s;
  }, []);
  const applyLocal = useCallback((action: GameAction) => {
    if (!logical.current) throw Error('게임이 없어요.');
    const result = applyAction(logical.current, action);
    logical.current = result.nextState;
    return result;
  }, []);
  return { logical, createSolo, applyLocal };
}
export function useCpuTurn({
  view,
  paused,
  logical,
  dispatch,
  difficulty,
  fast,
}: {
  view: GameView | null;
  paused: boolean;
  logical: React.RefObject<GameState | null>;
  dispatch: (a: GameAction) => void;
  difficulty: Difficulty;
  fast: boolean;
}) {
  useEffect(() => {
    if (paused || !view || view.currentPlayer === 0 || view.phase === 'FINISHED') return;
    const gameId = view.gameId,
      version = view.stateVersion;
    const timer = setTimeout(
      () => {
        const s = logical.current;
        if (!s || s.gameId !== gameId || s.stateVersion !== version || s.currentPlayer === 0)
          return;
        dispatch(chooseAction(projectState(s, s.currentPlayer), s.currentPlayer, difficulty));
      },
      fast ? 0 : 700 + Math.random() * 700,
    );
    return () => clearTimeout(timer);
  }, [view, paused, logical, dispatch, difficulty, fast]);
}
