export function PlayerPanel({
  name,
  score,
  go,
  active,
  turnLabel,
  dealer,
  wins,
  handCount,
  passes,
}: {
  name: string;
  score: number;
  go: number;
  active: boolean;
  turnLabel: string;
  dealer: boolean;
  wins: number;
  handCount?: number;
  passes?: number;
}) {
  return (
    <div className={`player-info ${active ? 'active' : ''}`}>
      <span className="player-name">
        {active && <small className="turn-badge">{turnLabel}</small>}
        <span className="player-name-text" title={name}>
          {name}
        </span>
        {handCount !== undefined && (
          <small className="hand-count" data-testid="opponent-hand">
            {handCount}장{passes ? ` · 뒤집기 ${passes}회` : ''}
          </small>
        )}
        {dealer && <small className="dealer-badge">선</small>}
        <small className="win-count">{wins}승</small>
      </span>
      <span className="player-score">
        {go > 0 && <small>{go}고</small>}
        <strong>{score}</strong>
        <span>점</span>
      </span>
    </div>
  );
}
