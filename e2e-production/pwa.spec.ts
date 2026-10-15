import { finishSolo } from './solo-helper';
import { test, expect } from '@playwright/test';
test('production caches first load, reloads offline, plays single and hides debug', async ({
  page,
  context,
}) => {
  // Full 21-turn three-player round includes up to 14 AI think delays (1.4s each).
  test.setTimeout(60000);
  await context.addInitScript(() => {
    localStorage.setItem(
      'toki-gostop.preferences.v1',
      JSON.stringify({ speed: 'fast', difficulty: 'easy', sound: false, haptic: false }),
    );
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
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?debug=1');
  await page.getByRole('button', { name: /혼자 치기/ }).click();
  await expect(page.getByTestId('game-table')).toBeVisible();
  await page.getByRole('button', { name: '게임 시작', exact: true }).click();
  await expect(page.getByRole('button', { name: '개발', exact: true })).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg?.active) return false;
        const names = await caches.keys();
        const name = names.find((name) => name.startsWith('toki-gostop-v1-assets-'));
        if (!name) return false;
        const cache = await caches.open(name);
        const keys = await cache.keys();
        return (
          keys.filter((r) => r.url.includes('/_next/static/')).length >= 3 &&
          keys.filter((r) => /\/cards\/m\d+-\d\.webp\?v=/.test(r.url)).length === 48
        );
      }),
    )
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: /혼자 치기/ })).toBeVisible();
  await expect(page).toHaveTitle('토끼고스톱 · 마주 앉은 것처럼');
  await page.getByRole('button', { name: '설정', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '편안하게, 내 속도로' })).toBeVisible();
  await page.goBack();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await page.getByRole('button', { name: /혼자 치기/ }).click();
  await expect(page.getByTestId('game-table')).toBeVisible();
  await page.getByRole('button', { name: '게임 시작', exact: true }).click();
  await expect
    .poll(() =>
      page
        .locator('.hand-card img')
        .evaluateAll(
          (images) =>
            images.length === 7 &&
            images.every(
              (image) =>
                (image as HTMLImageElement).complete &&
                (image as HTMLImageElement).naturalWidth > 0,
            ),
        ),
    )
    .toBe(true);
  await expect
    .poll(() => page.locator('.hand-card[aria-disabled="false"]').count(), { timeout: 12000 })
    .toBeGreaterThan(0);
  const version = await page.getByTestId('game-table').getAttribute('data-version');
  await page.locator('.hand-card[aria-disabled="false"]').first().click();
  if (await page.getByRole('button', { name: '한 장만 그냥 내기' }).isVisible())
    await page.getByRole('button', { name: '한 장만 그냥 내기' }).click();
  await expect(page.getByTestId('game-table')).not.toHaveAttribute('data-version', version!);
  await finishSolo(page);
  expect(await page.evaluate(() => !!(window as any).__gostopDebug)).toBe(false);
  await page.getByRole('button', { name: '대기실로', exact: true }).click();
  await page.getByRole('button', { name: /친구와 치기/ }).click();
  await page.getByRole('button', { name: '방 만들기', exact: true }).click();
  await expect(page.locator('.error-toast')).toContainText('인터넷에 연결한 뒤');
  expect(errors).toEqual([]);
  await context.setOffline(false);
});
