import { test, expect } from '@playwright/test';
import { friendTable, synchronized, readBrowserHistory, actCurrent } from './three-player-helper';
import { editMeta, findRoomByName, finishCreationCooldown } from './room-fixture';

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
      for (const [i, screen] of room.pages.entries())
        if (i !== seat) {
          await expect(screen.locator('.connection-banner strong')).toContainText(
            ['지훈', '민수', '영희'][seat],
          );
          await expect(screen.locator('.turn-message')).toContainText(
            ['지훈', '민수', '영희'][seat],
          );
        }
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

test('explicitly cancelling pending room creation closes it without blocking the next room', async ({
  page,
}) => {
  let release!: () => void;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requested = false;
  await page.route(/\/accounts:signUp\?/, async (route) => {
    requested = true;
    await hold;
    await route.continue();
  });
  const name = '취소' + Math.floor(Math.random() * 1000000);
  await page.goto('/');
  await page.getByRole('button', { name: /친구와 치기/ }).click();
  await page.getByLabel('내 이름').fill(name);
  await page.getByRole('button', { name: '방 만들기', exact: true }).click();
  await expect.poll(() => requested).toBe(true);
  await page.getByRole('button', { name: '나가기', exact: true }).click();
  await expect(page.getByRole('button', { name: /혼자 치기/ })).toBeVisible();
  release();
  await expect.poll(async () => (await findRoomByName(name))?.meta.status).toBe('closed');
  // Advance only the emulator's existing 10s creation quota, rather than waiting in real time.
  await finishCreationCooldown((await findRoomByName(name))!.meta.hostUid);
  await page.getByRole('button', { name: /친구와 치기/ }).click();
  await expect(page.getByRole('button', { name: '방 만들기', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '방 만들기', exact: true }).click();
  await expect(page.getByTestId('room-code')).toBeVisible();
  await expect(page.locator('.error-toast')).toHaveCount(0);
});
