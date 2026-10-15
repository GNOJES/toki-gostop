import { startDebugGame } from './debug-helper';
import { test, expect, type Page } from '@playwright/test';
import { observeFlights, recordedFlight } from './flight-observer';

async function fixture(page: Page, name: string) {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => localStorage.setItem('toki-gostop.preferences.v1', JSON.stringify({speed:'fast',difficulty:'easy',sound:false,haptic:false})));
  await page.goto('/?debug=1');
  await startDebugGame(page);
  await page.getByRole('button', { name: '개발', exact: true }).click();
  await page.getByRole('button', { name, exact: true }).click();
  await observeFlights(page);
}

function sameCenter(actual: [number, number], target: [number, number]) {
  expect(actual[0]).toBeCloseTo(target[0], 0);
  expect(actual[1]).toBeCloseTo(target[1], 0);
}

test('mobile bonus pauses at center then enters own captured pi without landing on floor', async ({
  page,
}) => {
  await fixture(page, '보너스 손패');
  await page.locator('.hand-card[data-card-id="bonus-0"]').click();
  await expect.poll(() => recordedFlight(page, 'bonus', 'bonus-0')).toBeTruthy();
  const preview = (await recordedFlight(page, 'bonus', 'bonus-0'))!;
  sameCenter(preview.to, preview.deck);
  await expect.poll(() => recordedFlight(page, 'bonus-capture', 'bonus-0')).toBeTruthy();
  const capture = (await recordedFlight(page, 'bonus-capture', 'bonus-0'))!;
  sameCenter(capture.from, capture.deck);
  sameCenter(capture.to, capture.ownPi);
  expect(preview.floorBonus || capture.floorBonus).toBe(false);
  await expect(page.locator('[data-floor-card-id="bonus-0"]')).toHaveCount(0);
  await expect(page.getByTestId('game-table')).toHaveAttribute('data-busy', 'false');
  await expect(
    page.locator('.own-panel .captured').locator('[data-captured-card-id="bonus-0"]'),
  ).toBeVisible();
});

test('mobile bomb creates two playable hand tokens and stolen pi flies from opponent', async ({
  page,
}) => {
  await fixture(page, '폭탄과 피 강탈');
  const stolen = (await page
    .locator('.captured')
    .first()
    .locator('[data-captured-card-id]')
    .getAttribute('data-captured-card-id'))!;
  await page.locator('.hand-card[data-card-id="m1-0"]').click();
  await page.getByRole('button', { name: '폭탄 내기', exact: true }).click();
  await expect.poll(() => recordedFlight(page, 'transfer', stolen)).toBeTruthy();
  const transfer = (await recordedFlight(page, 'transfer', stolen))!;
  expect(transfer.opponentCard).not.toBeNull();
  sameCenter(transfer.from, transfer.opponentCard!);
  sameCenter(transfer.to, transfer.ownPi);
  expect(transfer.effect).toContain('폭탄');
  expect(transfer.effectFont).toBeGreaterThanOrEqual(26);
  await expect(page.getByTestId('game-table')).toHaveAttribute('data-busy', 'false');
  await expect(
    page.locator('.captured').first().locator(`[data-captured-card-id="${stolen}"]`),
  ).toHaveCount(0);
  await expect(page.locator('.bomb-pass')).toHaveCount(2);
  await expect(page.locator('.pass-button')).toHaveCount(0);
  await expect(
    page.locator('.own-panel .captured').locator(`[data-captured-card-id="${stolen}"]`),
  ).toBeVisible();
  await expect(page.getByTestId('game-table')).toHaveAttribute('data-can-act', 'true');
  await page.locator('.bomb-pass').first().click();
  await expect(page.locator('.bomb-pass')).toHaveCount(1);
  await page.screenshot({ path: '/tmp/toki-bomb-board.png' });
});
