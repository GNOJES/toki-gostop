import { test, expect } from '@playwright/test';
import { startDebugGame } from './debug-helper';

for (const [streak, title, payment] of [
  [0, '첫뻑!', '상대에게 3점씩 · 총 6점 획득'],
  [1, '2연뻑!', '상대에게 6점씩 · 총 12점 추가'],
  [2, '3연뻑!', '상대에게 9점씩 · 총 18점 추가'],
] as const)
  test(`mobile opening ppuk notice shows ${title} and the new payment`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/?debug=1');
    await startDebugGame(page);
    await page.evaluate(async () => {
      await (window as any).__gostopDebug.fixture('뻑과 보너스');
    });
    await page.evaluate((streak) => {
      const debug = (window as any).__gostopDebug;
      const state = debug.getState();
      state.players[0].openingPpukStreak = streak;
      state.players[0].ppukCount = streak;
      state.deck.push(...state.players[0].hand.splice(7 - streak));
      state.players[0].turnsRemaining = 7 - streak;
      debug.load(state);
    }, streak);
    await page.locator('.hand-card[data-card-id="m1-2"]').click();
    const notice = page.locator('.callout.opening-ppuk');
    await expect(notice).toBeVisible();
    await expect(notice.locator('.effect-player')).toHaveText('나');
    await expect(notice).toContainText(title);
    await expect(notice.locator('small')).toHaveText(payment);
    await expect(notice).not.toContainText('승패');
    const box = await notice.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(320);
    if (streak === 0) {
      await page.waitForTimeout(900);
      await expect(notice).toBeVisible();
      await page.screenshot({ path: '/tmp/gostop-opening-ppuk.png' });
    }
    await expect(notice).toHaveCount(0);
  });
