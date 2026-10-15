import { piValue } from './cards';
import type { PlayerState, ScoreResult } from './types';
export function calculateScore(player: PlayerState): ScoreResult {
  const c = player.captured;
  const gwang = c.filter((x) => x.isGwang).length;
  const yeol = c.filter((x) => x.isYeol && !(x.specialType === 'KUKJIN' && player.kukjinAsPi));
  const ribbons = c.filter((x) => x.isTti);
  const countPi = c.reduce((n, x) => n + piValue(x, player.kukjinAsPi), 0);
  const trio = (kind: string) =>
    ribbons.filter((x) => x.ribbonType === kind).length === 3 ? 3 : 0;
  const gwangScore =
    gwang === 5
      ? 15
      : gwang === 4
        ? 4
        : gwang === 3
          ? c.some((x) => x.specialType === 'RAIN')
            ? 2
            : 3
          : 0;
  const yeolScore = Math.max(0, yeol.length - 4),
    godoriScore = yeol.filter((x) => x.isGodori).length === 3 ? 5 : 0;
  const ribbonScore = Math.max(0, ribbons.length - 4),
    hongdanScore = trio('HONGDAN'),
    cheongdanScore = trio('CHEONGDAN'),
    chodanScore = trio('CHODAN');
  const piScore = Math.max(0, countPi - 9);
  const baseScore =
    gwangScore +
    yeolScore +
    godoriScore +
    ribbonScore +
    hongdanScore +
    cheongdanScore +
    chodanScore +
    piScore;
  return {
    gwangScore,
    yeolScore,
    godoriScore,
    ribbonScore,
    hongdanScore,
    cheongdanScore,
    chodanScore,
    piScore,
    piCount: countPi,
    yeolCount: yeol.length,
    baseScore,
  };
}
