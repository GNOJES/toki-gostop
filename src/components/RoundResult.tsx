import { Modal } from './Modal';
import { transferDelta } from '../game-engine/settlement';
import type { GameView, SeatId, SeatTuple } from '../game-engine/types';
import type { Stats } from '../multiplayer/types';
export function RoundResult({
  view,
  me,
  names,
  stats,
  waiting,
  onNext,
  onLeave,
}: {
  view: GameView;
  me: SeatId;
  names: SeatTuple<string>;
  stats: Stats;
  waiting: boolean;
  onNext: () => void;
  onLeave: () => void;
}) {
  const r = view.result!;
  const instant = transferDelta(view.transactions.filter((t) => t.kind === 'INSTANT'));
  const winner = r.winner === null ? null : view.scores[r.winner];
  return (
    <Modal
      title={
        r.winner === null
          ? '다음 판을 기약해요'
          : r.winner === me
            ? '기분 좋은 한 판!'
            : `${names[r.winner]}의 멋진 한 판`
      }
      onClose={() => {}}
      className="result-modal"
    >
      <span className="eyebrow">
        {r.reason === 'NAGARI'
          ? `나가리 · 다음 판 ${(2n ** BigInt(view.nagariStreak + 1)).toString()}배`
          : r.reason === 'CHONGTONG'
            ? '총통'
            : r.reason === 'THREE_PPUK'
              ? '3뻑'
              : '스톱'}
      </span>
      <div className="decision-score">
        {r.settlement.roundDelta[me].toLocaleString()}
        <span>점</span>
      </div>
      {winner && (
        <p className="fine-print">
          기본 {r.settlement.baseScore}점 · 공통 배수 ×{r.settlement.commonMultiplier.toString()} ·
          광 {winner.gwangScore} / 열끗 {winner.yeolScore + winner.godoriScore} / 띠{' '}
          {winner.ribbonScore + winner.hongdanScore + winner.cheongdanScore + winner.chodanScore} /
          피 {winner.piScore}
        </p>
      )}
      <section className="match-summary" aria-label="세 사람 정산">
        <h3>이번 판 정산</h3>
        <table className="settlement-table">
          <thead>
            <tr>
              <th>이름</th>
              <th>즉시 점수</th>
              <th>판 변화</th>
              <th>누적</th>
            </tr>
          </thead>
          <tbody>
            {([0, 1, 2] as const).map((id) => (
              <tr key={id} data-result-seat={id}>
                <th>
                  {names[id]}
                  {id === me ? ' (나)' : ''}
                </th>
                <td>{instant[id].toString()}</td>
                <td>{r.settlement.roundDelta[id].toString()}</td>
                <td>{stats.points[id].toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {([0, 1, 2] as const)
          .filter((id) => r.settlement.liabilities[id] > 0n)
          .map((id) => {
            const payer = r.settlement.payerFor[id]!;
            const pi =
              r.reason === 'STOP' &&
              !!winner?.piScore &&
              view.scores[id].piCount >= 1 &&
              view.scores[id].piCount <= 5;
            const gwang =
              r.reason === 'STOP' &&
              !!winner?.gwangScore &&
              !view.players[id].captured.some((c) => c.isGwang);
            return (
              <p key={id} className="fine-print">
                {names[id]} 부담 {r.settlement.liabilities[id].toString()}점{pi ? ' · 피박 ×2' : ''}
                {gwang ? ' · 광박 ×2' : ''}
                {r.reason === 'STOP' && (winner?.yeolCount ?? 0) >= 7 ? ' · 멍따 ×2' : ''}
                {payer !== id ? ` · ${names[payer]} 독박으로 대신 지급` : ''}
              </p>
            );
          })}
      </section>
      <button className="primary" disabled={waiting} onClick={onNext}>
        {waiting ? '친구의 준비를 기다려요' : '한 판 더'}
      </button>
      <button className="text-button" onClick={onLeave}>
        대기실로
      </button>
    </Modal>
  );
}
