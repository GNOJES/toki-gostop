import { test, expect } from '@playwright/test';
test('two real browser tabs save the same immediate transaction exactly once in IndexedDB', async ({
  page,
  context,
}) => {
  const other = await context.newPage();
  await Promise.all([page.goto('/?debug=1'), other.goto('/?debug=1')]);
  for (const p of [page, other]) await p.waitForFunction(() => !!(window as any).__gostopDebug);
  const save = (p: typeof page) =>
    p.evaluate(async () => {
      const t = {
        id: 'concurrent-journal:instant:1',
        from: 2,
        to: 0,
        amount: 9n,
        kind: 'INSTANT',
        reason: 'OPENING_PPUK',
      };
      return (window as any).__gostopDebug.saveProgress({
        gameId: 'concurrent-journal',
        mode: 'single',
        names: ['나', 'A', 'B'],
        me: 0,
        transactions: [t],
        result: null,
      });
    });
  await Promise.all([save(page), save(other)]);
  await page.getByRole('button', { name: '최근 기록', exact: true }).click();
  await expect(page.locator('.history-summary')).toContainText('누적 9점');
  await expect(page.locator('.history-list:not(.instant-list) li')).toHaveCount(0);
  const persisted = await page.evaluate(
    () =>
      new Promise<any>((resolve, reject) => {
        const r = indexedDB.open('toki-gostop-history-v1');
        r.onsuccess = () => {
          const db = r.result,
            tx = db.transaction('history'),
            q = tx.objectStore('history').get('current');
          q.onsuccess = () => resolve(q.result);
          tx.oncomplete = () => db.close();
        };
        r.onerror = () => reject(r.error);
      }),
  );
  expect(persisted.solo.points).toBe('9');
  expect(persisted.instant).toHaveLength(1);
  await expect(page.locator('.instant-list li')).toHaveCount(1);
});

test('more than 100 completed rounds retain dedupe and exact signed totals in native IndexedDB', async ({
  page,
}) => {
  await page.goto('/?debug=1');
  await page.waitForFunction(() => !!(window as any).__gostopDebug);
  const h = await page.evaluate(async () => {
    const debug = (window as any).__gostopDebug;
    const input = (n: number) => {
      const id = 'retention:' + n,
        t = { id, from: 0, to: 2, amount: 7n, kind: 'FINAL', reason: 'STOP' };
      return {
        gameId: id,
        mode: 'single',
        names: ['A', 'B', '나'],
        me: 2,
        transactions: [t],
        result: {
          winner: 2,
          reason: 'STOP',
          settlement: {
            baseScore: 7,
            commonMultiplier: 1n,
            liabilities: [7n, 0n, 0n],
            payerFor: [0, null, null],
            transfers: [t],
            roundDelta: [-7n, 0n, 7n],
          },
        },
      };
    };
    let h;
    for (let n = 0; n < 101; n++) h = await debug.saveProgress(input(n));
    return debug.saveProgress(input(0));
  });
  expect(h.recent).toHaveLength(100);
  expect(h.solo).toMatchObject({ wins: 101, points: '707' });
  await page.reload();
  await page.getByRole('button', { name: '최근 기록', exact: true }).click();
  await expect(page.locator('.history-summary')).toContainText('101승');
  await expect(page.locator('.history-summary')).toContainText('707점');
  await expect(page.locator('.history-list:not(.instant-list) li')).toHaveCount(100);
});
