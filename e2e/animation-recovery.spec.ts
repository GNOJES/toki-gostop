import { friendTable, synchronized, actCurrent } from './three-player-helper';
import { test, expect } from '@playwright/test';
import { createFixture } from '../src/game-engine/fixtures';
import { editRoom } from './room-fixture';
test('animation failure restores readiness without reloading', async ({ browser }) => {
  const room = await friendTable(browser);
  const { pages } = room;
  try {
    await synchronized(pages);
    // A bonus keeps the same guest's turn after recovery, exposing any toast over the hand.
    await editRoom(room.code, (state) => {
      const game = createFixture('보너스 손패');
      game.gameId = state.game!.gameId;
      [game.players[0], game.players[1]] = [game.players[1], game.players[0]];
      game.currentPlayer = 1;
      state.game = game;
    });
    const actor = pages[1];
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
    await actor.locator('.hand-card[data-card-id="bonus-0"]').click();
    const plain = actor.getByRole('button', { name: '한 장만 그냥 내기' });
    if (await plain.isVisible()) await plain.click();
    await expect(actor.getByText('패 이동을 복구했어요. 계속 칠 수 있어요.')).toBeVisible();
    await expect(actor.getByTestId('game-table')).toHaveAttribute('data-busy', 'false');
    await synchronized(pages);
    await expect(actor.getByTestId('game-table')).toHaveAttribute('data-current', '1');
    await actor
      .locator('.hand-card[aria-disabled="false"]')
      .first()
      .click({ trial: true, timeout: 2000 });
    expect(await actCurrent(pages)).toBe(true);
  } finally {
    await room.close();
  }
});
