import { test, expect } from '@playwright/test';
import { friendTable, synchronized, readBrowserHistory, actCurrent } from './three-player-helper';
import { editMeta } from './room-fixture';

test('each UID and two guests can disconnect and resume the same paused round', async ({
  browser,
}) => {
  const room = await friendTable(browser);
  try {
    await synchronized(room.pages);
    const version = await room.pages[0].getByTestId('game-table').getAttribute('data-version');
    for (const seat of [0, 1, 2]) {
      const watcher = room.pages[(seat + 1) % 3];
      await room.contexts[seat].setOffline(true);
      await expect(watcher.locator('.connection-banner')).toBeVisible();
      for (const p of room.pages)
        await expect(p.getByTestId('game-table')).toHaveAttribute('data-can-act', 'false');
      await room.contexts[seat].setOffline(false);
      await room.pages[seat].reload();
      await synchronized(room.pages);
      for (const [i, p] of room.pages.entries()) {
        await expect(p.getByTestId('game-table')).toHaveAttribute('data-me', String(i));
        await expect(p.getByTestId('game-table')).toHaveAttribute('data-version', version!);
        await expect(p.locator('.connection-banner')).toHaveCount(0);
      }
    }
    const host = room.pages[0];
    await host.clock.install();
    await Promise.all(room.contexts.slice(1).map((c) => c.setOffline(true)));
    await expect(host.locator('.connection-banner')).toBeVisible();
    await host.clock.setSystemTime(Date.now() + 121000);
    const end = host.getByRole('button', { name: '기다림을 끝내고 나가기' });
    await expect(end).toBeVisible();
    await end.click();
    await host.getByRole('button', { name: '계속 치기', exact: true }).click();
    await Promise.all(room.contexts.slice(1).map((c) => c.setOffline(false)));
    await synchronized(room.pages);
    await expect(host.locator('.connection-banner')).toHaveCount(0);
    for (const p of room.pages) {
      await expect(p.getByTestId('game-table')).toHaveAttribute('data-version', version!);
      expect((await readBrowserHistory(p)).recent).toHaveLength(0);
    }
    await actCurrent(room.pages);
  } finally {
    await room.close();
  }
});

test('a fourth UID is rejected and a 24 hour expiry closes every seat without a result', async ({
  browser,
}) => {
  const room = await friendTable(browser);
  const fourth = await browser.newContext();
  try {
    await synchronized(room.pages);
    const p = await fourth.newPage();
    await p.goto('/?room=' + room.code);
    await p.getByLabel('내 이름').fill('네번째');
    await p.getByRole('button', { name: '참여하기', exact: true }).click();
    await expect(p.locator('.error-toast')).toBeVisible();
    await expect(p.getByTestId('game-table')).toHaveCount(0);
    const now = Date.now();
    await editMeta(room.code, { createdAt: now - 86400001, expiresAt: now - 1 });
    for (const p of room.pages) {
      await expect(p.getByRole('button', { name: '홈으로 돌아가기', exact: true })).toBeVisible();
      expect((await readBrowserHistory(p)).recent).toHaveLength(0);
    }
  } finally {
    await fourth.close();
    await room.close();
  }
});
