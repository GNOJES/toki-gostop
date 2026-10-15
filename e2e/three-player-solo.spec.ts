import { test, expect, type Page } from '@playwright/test';
import { startDebugGame } from './debug-helper';
async function ready(page: Page) {
  await page.goto('/?debug=1');
  await startDebugGame(page);
  await page.waitForFunction(() => !!(window as any).__gostopDebug);
  await page.evaluate(() => (window as any).__gostopDebug.skip());
}
async function playHuman(page: Page) {
  const table = page.getByTestId('game-table');
  await expect(table).toHaveAttribute('data-busy', 'false');
  const phase = await table.getAttribute('data-phase');
  if (phase === 'FINISHED') return;
  if ((await table.getAttribute('data-can-act')) !== 'true') return;
  if (phase === 'GO_STOP')
    await page.getByRole('button', { name: '스톱 이번 판을 마쳐요' }).click();
  else if (phase === 'SELECT_KUKJIN')
    await page.getByRole('button', { name: /쌍피로 사용/ }).click();
  else if (phase === 'SELECT_FLOOR') await page.locator('.floor-choices button').first().click();
  else {
    const hand = page.locator('.hand-card[data-card-id]');
    if (await hand.count()) await hand.first().click();
    else
      await page
        .getByRole('button', { name: /폭탄패 사용/ })
        .first()
        .click();
    if (await page.getByRole('button', { name: '한 장만 그냥 내기' }).isVisible())
      await page.getByRole('button', { name: '한 장만 그냥 내기' }).click();
  }
}
test('mobile three player solo finishes, records one result, starts next round and retains history', async ({
  page,
}) => {
  await ready(page);
  await expect(page.locator('.opponent-panel')).toHaveCount(2);
  for (let n = 0; n < 150; n++) {
    if ((await page.getByTestId('game-table').getAttribute('data-phase')) === 'FINISHED') break;
    await playHuman(page);
    await page.waitForTimeout(30);
  }
  await expect(page.getByTestId('game-table')).toHaveAttribute('data-phase', 'FINISHED');
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.locator('[data-result-seat]')).toHaveCount(3);
  await page.getByRole('button', { name: '한 판 더', exact: true }).click();
  await expect(page.getByTestId('game-table')).toHaveAttribute('data-round', '2');
  await page.reload();
  await page.getByRole('button', { name: '최근 기록', exact: true }).click();
  await expect(page.locator('.history-list:not(.instant-list) li')).toHaveCount(1);
});
for (const [width, height] of [
  [390, 844],
  [360, 640],
  [320, 568],
])
  test(`mobile three-player layout ${width}x${height} fits cards and decisions`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await ready(page);
    await page.getByRole('button', { name: '개발', exact: true }).click();
    await page.getByRole('button', { name: '열두 달 바닥', exact: true }).click();
    const boxes = await page
      .locator('.game-table,.floor-area,.hand-area,.opponent-panel')
      .evaluateAll((nodes) => nodes.map((n) => n.getBoundingClientRect().toJSON()));
    for (const b of boxes) {
      expect(b.top).toBeGreaterThanOrEqual(0);
      expect(b.bottom).toBeLessThanOrEqual(height + 1);
      expect(b.left).toBeGreaterThanOrEqual(0);
      expect(b.right).toBeLessThanOrEqual(width + 1);
    }
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(height);
    await page.screenshot({ path: `test-results/gostop-${width}x${height}.png` });
  });
