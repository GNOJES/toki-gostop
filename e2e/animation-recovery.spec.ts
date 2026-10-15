import { friendTable, synchronized, actCurrent } from './three-player-helper';
import { test, expect } from '@playwright/test';
test('animation failure restores readiness without reloading', async ({ browser }) => {
  const room = await friendTable(browser);
  const { pages } = room;
  try {
    await synchronized(pages);
    const actor =
      pages[Number(await pages[0].getByTestId('game-table').getAttribute('data-current'))];
    await expect(actor.getByTestId('game-table')).toHaveAttribute('data-can-act', 'true');
    await actor.evaluate(() => {
      const original = document.querySelector.bind(document);
      let failed = false;
      document.querySelector = ((selector: string) => {
        if (selector === '.floor-area' && !failed) {
          failed = true;
          throw new Error('audit animation fault');
        }
        return original(selector);
      }) as typeof document.querySelector;
    });
    await actor.locator('.hand-card').first().click();
    const plain = actor.getByRole('button', { name: '한 장만 그냥 내기' });
    if (await plain.isVisible()) await plain.click();
    await expect(actor.getByText('패 이동을 복구했어요. 계속 칠 수 있어요.')).toBeVisible();
    await expect(actor.getByTestId('game-table')).toHaveAttribute('data-busy', 'false');
    await synchronized(pages);
    expect(await actCurrent(pages)).toBe(true);
  } finally {
    await room.close();
  }
});
