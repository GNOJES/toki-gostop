import { friendTable, synchronized, actCurrent, readBrowserHistory } from './three-player-helper';
import { startDebugGame } from './debug-helper';
import { openHandZoom } from './zoom-helper';
import { test, expect, type Page, type BrowserContext } from '@playwright/test';
async function speed(context: BrowserContext) {
  await context.addInitScript(() => {
    localStorage.setItem(
      'toki-gostop.preferences.v1',
      JSON.stringify({ speed: 'fast', difficulty: 'normal', sound: false, haptic: false }),
    );
  });
}
async function game(page: Page) {
  await expect(page.getByTestId('game-table')).toBeVisible();
}
async function act(page: Page) {
  const table = page.getByTestId('game-table');
  // One browser snapshot: the computer may finish between separate protocol calls.
  const {
    phase,
    canAct,
    busy,
    version: before,
  } = await table.evaluate((el) => ({ ...(el as HTMLElement).dataset }));
  if (phase === 'FINISHED' || canAct !== 'true' || busy !== 'false') return false;
  if (phase === 'SELECT_KUKJIN') await page.getByRole('button', { name: /쌍피로 사용/ }).click();
  else if (phase === 'GO_STOP')
    await page.getByRole('button', { name: '스톱 이번 판을 마쳐요' }).click();
  else if (phase === 'SELECT_FLOOR') await page.locator('.floor-choices button').first().click();
  else {
    const pass = page.getByRole('button', { name: /폭탄패 사용/ });
    if ((await page.locator('.hand-card[data-card-id]').count()) === 0 && (await pass.isVisible()))
      await pass.first().click();
    else {
      await page.locator('.hand-card[aria-disabled="false"]').first().click();
      if (await page.getByRole('button', { name: '한 장만 그냥 내기' }).isVisible())
        await page.getByRole('button', { name: '한 장만 그냥 내기' }).click();
    }
  }
  await expect(table).not.toHaveAttribute('data-version', before!);
  await expect(table).toHaveAttribute('data-busy', 'false');
  return true;
}
for (const [width, height] of [
  [360, 800],
  [375, 812],
  [390, 844],
  [412, 915],
])
  test(`mobile ${width}×${height} fits all areas / zoom / settings`, async ({ page, context }) => {
    await speed(context);
    // Stable display deal: a random chongtong would open a result modal before zoom.
    // This override only runs inside this test's browser context.
    await context.addInitScript(() => {
      let seed = 12345;
      const original = crypto.getRandomValues.bind(crypto);
      Object.defineProperty(crypto, 'getRandomValues', {
        value: (array: ArrayBufferView) => {
          if (!(array instanceof Uint32Array)) return original(array);
          for (let i = 0; i < array.length; i++) {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            array[i] = seed;
          }
          return array;
        },
      });
    });
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await page.getByRole('button', { name: /혼자 치기/ }).click();
    await game(page);
    await page.getByRole('button', { name: '게임 시작', exact: true }).click();
    const rects = await page.locator('[data-testid]').evaluateAll((els) =>
      els.map((el) => ({
        name: el.getAttribute('data-testid'),
        r: el.getBoundingClientRect().toJSON(),
      })),
    );
    for (const { r } of rects) {
      expect(r.top).toBeGreaterThanOrEqual(0);
      expect(r.bottom).toBeLessThanOrEqual(height);
      expect(r.right).toBeLessThanOrEqual(width);
    }
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(height);
    await expect(page.getByTestId('opponent-hand')).toHaveText(['7장', '7장']);
    await expect(page.getByTestId('opponent-hand').locator('img')).toHaveCount(0);
    expect(await page.locator('.hand-card[data-card-id]').count()).toBe(7);
    await expect
      .poll(() =>
        page
          .locator('.hand-card img')
          .evaluateAll((images) =>
            images.every(
              (image) =>
                (image as HTMLImageElement).complete &&
                (image as HTMLImageElement).naturalWidth > 0,
            ),
          ),
      )
      .toBe(true);
    await openHandZoom(page);
    await expect(page.locator('dialog.zoom-modal[open]')).toBeVisible();
    await page.getByRole('button', { name: '닫기' }).click();
    await page.getByRole('button', { name: '설정', exact: true }).click();
    await expect(page.getByRole('dialog', { name: '편안하게, 내 속도로' })).toBeVisible();
    await page.getByRole('button', { name: '이대로 좋아요' }).click();
    await page.screenshot({ path: `test-results/mobile-${width}.png` });
  });
test('mobile single rounds accumulate across reload and new session, with confirmed reset', async ({
  page,
  context,
}) => {
  await speed(context);
  await page.goto('/?debug=1');
  await startDebugGame(page);
  await page.getByRole('button', { name: '개발', exact: true }).click();
  await page.getByLabel('애니메이션 건너뛰기').check();
  await page.getByRole('button', { name: '닫기' }).click();
  for (let round = 1; round <= 3; round++) {
    await game(page);
    for (let steps = 0; steps < 100; steps++) {
      const phase = await page.getByTestId('game-table').getAttribute('data-phase');
      if (phase === 'FINISHED') break;
      if (!(await act(page))) await page.waitForTimeout(150);
    }
    await expect(page.getByTestId('game-table')).toHaveAttribute('data-phase', 'FINISHED');
    await expect(page.getByRole('button', { name: '한 판 더', exact: true })).toBeVisible();
    if (round < 3) await page.getByRole('button', { name: '한 판 더', exact: true }).click();
  }
  await page.getByRole('button', { name: '대기실로', exact: true }).click();
  await page.goto('/?debug=1');
  await page.reload();
  await page.getByRole('button', { name: /최근 기록/ }).click();
  const history = page.getByRole('dialog', { name: '최근 기록', exact: true });
  await expect(history).toContainText('총 3판');
  await expect(history.locator('.history-list:not(.instant-list) li')).toHaveCount(3);
  await history.getByRole('button', { name: '닫기', exact: true }).click();
  await startDebugGame(page);
  await page.getByRole('button', { name: '개발', exact: true }).click();
  await page.getByLabel('애니메이션 건너뛰기').check();
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  for (let steps = 0; steps < 100; steps++) {
    if ((await page.getByTestId('game-table').getAttribute('data-phase')) === 'FINISHED') break;
    if (!(await act(page))) await page.waitForTimeout(150);
  }
  await expect(page.getByTestId('game-table')).toHaveAttribute('data-phase', 'FINISHED');
  await page.getByRole('button', { name: '대기실로', exact: true }).click();
  await page.getByRole('button', { name: /최근 기록/ }).click();
  await expect(history).toContainText('총 4판');
  await expect(history.locator('.history-list:not(.instant-list) li')).toHaveCount(4);
  await page.screenshot({ path: '/tmp/toki-recent-records.png' });
  await history.getByRole('button', { name: '혼자 치기 기록 초기화', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: '혼자 치기 기록을 초기화할까요?' });
  await confirm.getByRole('button', { name: '취소', exact: true }).click();
  await expect(history).toContainText('총 4판');
  await history.getByRole('button', { name: '혼자 치기 기록 초기화', exact: true }).click();
  await confirm.getByRole('button', { name: '기록 초기화', exact: true }).click();
  await expect(history).toContainText('총 0판');
  await expect(history.locator('.history-list:not(.instant-list) li')).toHaveCount(0);
  await history.getByRole('button', { name: '닫기', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: /최근 기록/ }).click();
  await expect(history).toContainText('총 0판');
});
test('three contexts: shared state, complete round, independent history and unanimous next round', async ({
  browser,
}) => {
  const room = await friendTable(browser);
  try {
    const { pages } = room;
    await synchronized(pages);
    for (const p of pages) await expect(p.locator('.opponent-panel')).toHaveCount(2);
    const floor = await Promise.all(
      pages.map((p) =>
        p
          .locator('.floor-card')
          .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-floor-card-id')).sort()),
      ),
    );
    expect(floor[0]).toEqual(floor[1]);
    expect(floor[1]).toEqual(floor[2]);
    let steps = 0;
    while (
      (await pages[0].getByTestId('game-table').getAttribute('data-phase')) !== 'FINISHED' &&
      steps++ < 120
    )
      await actCurrent(pages);
    await synchronized(pages);
    for (const p of pages)
      await expect(p.getByTestId('game-table')).toHaveAttribute('data-phase', 'FINISHED');
    for (const [i, p] of pages.entries()) {
      const h = await readBrowserHistory(p);
      expect(h.recent).toHaveLength(1);
      expect(h.recent[0].me).toBe(i);
      expect(h.solo.wins + h.solo.losses + h.solo.draws).toBe(0);
      await expect(p.locator('[data-result-seat]')).toHaveCount(3);
    }
    for (const [i, p] of pages.entries()) {
      await p.getByRole('button', { name: '한 판 더', exact: true }).click();
      if (i < 2) await expect(p.getByTestId('game-table')).toHaveAttribute('data-round', '1');
    }
    for (const p of pages)
      await expect(p.getByTestId('game-table')).toHaveAttribute('data-round', '2');
  } finally {
    await room.close();
  }
});
