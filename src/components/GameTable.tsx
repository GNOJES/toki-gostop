import type { ReactNode } from 'react';
import type { GameView, SeatId } from '../game-engine/types';
export function GameTable({
  view,
  me,
  round,
  busy,
  canPlay,
  children,
}: {
  view: GameView;
  me: SeatId;
  round: number;
  busy: boolean;
  canPlay: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className="game-table"
      data-testid="game-table"
      aria-label="고스톱 게임판"
      data-phase={view.phase}
      data-current={view.currentPlayer}
      data-me={me}
      data-version={view.stateVersion}
      data-round={round}
      data-busy={busy}
      data-can-act={canPlay}
    >
      {children}
    </section>
  );
}
