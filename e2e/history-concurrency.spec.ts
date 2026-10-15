import { test, expect } from '@playwright/test';
import { readBrowserHistory } from './three-player-helper';
test('native history transactions serialize tabs, reset in order and never import matgo cache', async ({
  context,
}) => {
  const a = await context.newPage(),
    b = await context.newPage();
  for (const p of [a, b]) {
    await p.goto('/?debug=1');
    await p.waitForFunction(() => !!(window as any).__gostopDebug);
  }
  const save = (page: typeof a, id: string) =>
    page.evaluate(async (id) => {
      const t = { id, from: 1, to: 0, amount: 7n, kind: 'FINAL', reason: 'STOP' };
      return (window as any).__gostopDebug.saveProgress({
        gameId: id,
        mode: 'single',
        names: ['나', 'A', 'B'],
        me: 0,
        transactions: [t],
        result: {
          winner: 0,
          reason: 'STOP',
          settlement: {
            baseScore: 7,
            commonMultiplier: 1n,
            liabilities: [0n, 7n, 0n],
            payerFor: [null, 1, null],
            transfers: [t],
            roundDelta: [7n, -7n, 0n],
          },
        },
      });
    }, id);
  await Promise.all([save(a, 'native-a'), save(b, 'native-b')]);
  expect((await readBrowserHistory(a)).solo).toMatchObject({ wins: 2, points: '14' });
  await a.getByRole('button', { name: '최근 기록', exact: true }).click();
  await a.getByRole('button', { name: '혼자 치기 기록 초기화', exact: true }).click();
  await a.getByRole('button', { name: '기록 초기화', exact: true }).click();
  await expect.poll(async () => (await readBrowserHistory(a)).solo.wins).toBe(0);
  await save(b, 'native-c');
  expect((await readBrowserHistory(a)).solo).toMatchObject({ wins: 1, points: '7' });
  await a.evaluate(() => localStorage.setItem('toki.play-history.v1', '{}'));
  expect((await readBrowserHistory(b)).solo.wins).toBe(1);
});
