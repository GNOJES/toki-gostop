import { expect, type Page } from '@playwright/test';

/** A cold load can expose the start button before the debug query effect commits. */
export async function startDebugGame(page: Page) {
  await page.getByRole('button', { name: /혼자 치기/ }).click();
  await expect(page.getByRole('button', { name: '개발', exact: true })).toBeVisible();
  const notice = page.getByRole('dialog', { name: '이번 판의 선' });
  if (await notice.isVisible())
    await notice.getByRole('button', { name: '게임 시작', exact: true }).click();
}
