import type { Page } from '@playwright/test';
export async function seedHistory(page: Page) {
  await page.goto('/?debug=1');
  await page.waitForFunction(() => !!(window as any).__gostopDebug);
  await page.evaluate(async () => {
    for (const mode of ['single', 'multi']) {
      const id = `seed-${mode}`,
        transaction = {
          id: `${id}:final:1`,
          from: 1,
          to: 0,
          amount: 7n,
          kind: 'FINAL',
          reason: 'STOP',
        };
      await (window as any).__gostopDebug.saveProgress({
        gameId: id,
        mode,
        names: ['나', '친구', '토끼'],
        me: 0,
        transactions: [transaction],
        result: {
          winner: 0,
          reason: 'STOP',
          settlement: {
            baseScore: 7,
            commonMultiplier: 1n,
            liabilities: [0n, 7n, 0n],
            payerFor: [null, 1, null],
            transfers: [transaction],
            roundDelta: [7n, -7n, 0n],
          },
        },
        at: 1000,
      });
    }
  });
}
