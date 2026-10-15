import { expect, type Page } from '@playwright/test';
export async function finishSolo(page: Page) {
  const table = page.getByTestId('game-table');
  for (let i = 0; i < 100; i++) {
    const observed = await table.getAttribute('data-version');
    await expect
      .poll(
        async () =>
          (await table.getAttribute('data-version')) !== observed ||
          (await table.getAttribute('data-phase')) === 'FINISHED' ||
          ((await table.getAttribute('data-can-act')) === 'true' &&
            (await table.getAttribute('data-busy')) === 'false'),
      )
      .toBe(true);
    const phase = await table.getAttribute('data-phase');
    if (phase === 'FINISHED') break;
    if (
      (await table.getAttribute('data-can-act')) !== 'true' ||
      (await table.getAttribute('data-busy')) !== 'false'
    )
      continue;
    const before = await table.getAttribute('data-version');
    if (phase === 'GO_STOP')
      await page.getByRole('button', { name: '스톱 이번 판을 마쳐요' }).click();
    else if (phase === 'SELECT_KUKJIN')
      await page.getByRole('button', { name: /쌍피로 사용/ }).click();
    else if (phase === 'SELECT_FLOOR') await page.locator('.floor-choices button').first().click();
    else {
      const hand = page.locator('.hand-card[aria-disabled="false"]');
      if (await hand.count()) await hand.first().click();
      else
        await page
          .getByRole('button', { name: /폭탄패 사용/ })
          .first()
          .click();
      const plain = page.getByRole('button', { name: '한 장만 그냥 내기' });
      if (await plain.isVisible()) await plain.click();
    }
    await expect(table).not.toHaveAttribute('data-version', before!);
  }
  await expect(table).toHaveAttribute('data-phase', 'FINISHED');
  await expect(page.locator('[data-result-seat]')).toHaveCount(3);
}
