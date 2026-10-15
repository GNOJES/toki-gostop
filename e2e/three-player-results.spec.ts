import { test, expect } from '@playwright/test';
import { friendTable, synchronized, readBrowserHistory } from './three-player-helper';
import { editRoom } from './room-fixture';
import { createFixture } from '../src/game-engine/fixtures';

test('seat two stops: last Go payer covers both, zero pi is exempt, huge signed totals stay exact', async ({
  browser,
}) => {
  const room = await friendTable(browser);
  try {
    await synchronized(room.pages);
    const huge = 2n ** 80n;
    await editRoom(room.code, (s) => {
      const g = createFixture('국화 점수 선택');
      g.gameId = s.game!.gameId;
      [g.players[0], g.players[2]] = [g.players[2], g.players[0]];
      g.currentPlayer = 2;
      g.lastGo = 1;
      s.game = g;
      s.stats.points = [huge, 0n, -huge];
    });
    const p = room.pages[2];
    await expect(p.getByTestId('game-table')).toHaveAttribute('data-can-act', 'true');
    await p.getByRole('button', { name: '국화 열끗 · 쌍피 선택', exact: true }).click();
    await p.getByRole('button', { name: /쌍피로 사용/ }).click();
    await p.getByRole('button', { name: '스톱 이번 판을 마쳐요' }).click();
    await synchronized(room.pages);
    for (const screen of room.pages) {
      await expect(screen.locator('.result-modal')).toContainText('민수 독박으로 대신 지급');
      await expect(screen.locator('.result-modal')).not.toContainText('피박 ×2');
      const table = screen.locator('.settlement-table');
      await expect(table.locator('tbody tr')).toHaveCount(3);
      await expect(table.locator('tbody tr').first()).toContainText(huge.toLocaleString());
      await expect(table.locator('tbody tr').last()).toContainText((-huge + 6n).toLocaleString());
      expect(await table.evaluate((el) => el.getBoundingClientRect().right <= innerWidth)).toBe(
        true,
      );
    }
    const histories = await Promise.all(room.pages.map(readBrowserHistory));
    expect(histories.map((h) => h.recent[0].me)).toEqual([0, 1, 2]);
    expect(histories[2].recent[0]).toMatchObject({
      names: ['지훈', '민수', '영희'],
      delta: ['0', '-6', '6'],
      winner: 2,
    });
    await room.pages[1].reload();
    await expect(room.pages[1].locator('.result-modal')).toBeVisible();
    expect((await readBrowserHistory(room.pages[1])).recent).toHaveLength(1);
  } finally {
    await room.close();
  }
});

test('opening ppuk transactions survive a room exit without inventing a completed round', async ({
  browser,
}) => {
  const room = await friendTable(browser);
  try {
    await synchronized(room.pages);
    await editRoom(room.code, (s) => {
      const g = createFixture('뻑과 보너스');
      g.gameId = s.game!.gameId;
      s.game = g;
    });
    const p = room.pages[0];
    await expect(p.getByTestId('game-table')).toHaveAttribute('data-can-act', 'true');
    await p.locator('.hand-card[data-card-id="m1-2"]').click();
    await synchronized(room.pages);
    await expect
      .poll(async () => {
        const values = await Promise.all(room.pages.map(readBrowserHistory));
        return (
          values.every((h) => h?.instant?.length === 2) &&
          values.every((h) => h?.recent?.length === 0)
        );
      })
      .toBe(true);
    await p.getByRole('button', { name: '나가기', exact: true }).click();
    await p.getByRole('button', { name: '대기실로', exact: true }).click();
    for (const screen of room.pages.slice(1))
      await expect(
        screen.getByRole('button', { name: '홈으로 돌아가기', exact: true }),
      ).toBeVisible();
    for (const screen of room.pages) {
      const h = await readBrowserHistory(screen);
      expect(h.recent).toHaveLength(0);
      expect(h.solo.points).toBe('0');
      expect(h.instant.map((r: any) => r.transfer.amount)).toEqual(['3', '3']);
      expect(h.instant.every((r: any) => r.transfer.to === 0)).toBe(true);
      const count = await screen.evaluate(
        () =>
          new Promise<number>((resolve, reject) => {
            const r = indexedDB.open('toki-gostop-history-v1');
            r.onsuccess = () => {
              const db = r.result,
                t = db.transaction('appliedTransfers'),
                q = t.objectStore('appliedTransfers').count();
              q.onsuccess = () => resolve(q.result);
              t.oncomplete = () => db.close();
            };
            r.onerror = () => reject(r.error);
          }),
      );
      expect(count).toBe(2);
    }
  } finally {
    await room.close();
  }
});

test('self ppuk takes two pi from each source seat and displays all four moved identities', async ({
  browser,
}) => {
  const room = await friendTable(browser);
  const moved: string[] = [];
  try {
    await synchronized(room.pages);
    await editRoom(room.code, (s) => {
      const g = createFixture('자뻑');
      g.gameId = s.game!.gameId;
      for (const id of [1, 2] as const) {
        for (let n = 0; n < 2; n++) {
          const at = g.deck.findIndex((c) => c.piValue === 1);
          if (at < 0) throw Error('fixture needs pi');
          const [card] = g.deck.splice(at, 1);
          g.players[id].captured.push(card);
          moved.push(card.id);
        }
      }
      s.game = g;
    });
    const p = room.pages[0];
    await expect(p.getByTestId('game-table')).toHaveAttribute('data-version', '1');
    await expect(p.getByTestId('game-table')).toHaveAttribute('data-can-act', 'true');
    await p.locator('.hand-card[data-card-id="m1-3"]').click();
    await synchronized(room.pages);
    for (const screen of room.pages) {
      for (const id of moved) {
        await expect(
          screen.locator(`[data-player-seat="0"] [data-captured-card-id="${id}"]`),
        ).toHaveCount(1);
        await expect(
          screen.locator(
            `.opponents [data-player-seat="1"] [data-captured-card-id="${id}"],.opponents [data-player-seat="2"] [data-captured-card-id="${id}"]`,
          ),
        ).toHaveCount(0);
      }
    }
  } finally {
    await room.close();
  }
});
