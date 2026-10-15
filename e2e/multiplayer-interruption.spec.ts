import { test, expect } from '@playwright/test';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { get, ref, runTransaction } from 'firebase/database';
import { createFixture } from '../src/game-engine/fixtures';
import { applyAction } from '../src/game-engine/engine';
import { decodeState } from '../src/multiplayer/state-codec';
import { friendTable, synchronized } from './three-player-helper';
import { encodeState } from '../src/multiplayer/host';

test('mandatory chrysanthemum choice releases the screen on disconnect and resumes unchanged', async ({
  browser,
}) => {
  const room = await friendTable(browser);
  const [a, b] = room.contexts;
  const [pa, pb, pc] = room.pages;
  const { code } = room;
  const env = await initializeTestEnvironment({
    projectId: 'demo-toki-gostop',
    database: { host: '127.0.0.1', port: 9100 },
  });
  try {
    await synchronized(room.pages);
    await env.withSecurityRulesDisabled(async (context) => {
      const location = ref(
        context.database('https://demo-toki-gostop-default-rtdb.firebaseio.com'),
        `rooms/${code}/state`,
      );
      const initial = await get(location);
      expect(initial.exists()).toBe(true);
      await runTransaction(
        location,
        (value) => {
          const state = decodeState({ state: value ?? initial.val() });
          const oldGame = state.game!;
          state.game = applyAction(createFixture('국화 점수 선택'), {
            type: 'PLAY_CARD',
            player: 0,
            cardId: 'm2-0',
          }).nextState;
          state.game.gameId = oldGame.gameId;
          state.game.stateVersion = oldGame.stateVersion + 1;
          state.events = [{ type: 'KUKJIN_REQUIRED', player: 0 }];
          state.revision++;
          return encodeState(state);
        },
        { applyLocally: false },
      );
    });
    const choice = pa.getByRole('dialog', { name: '국화를 쌍피로 사용할까요?' });
    await expect(choice).toBeVisible();
    const version = await pa.getByTestId('game-table').getAttribute('data-version');
    await b.setOffline(true);
    await expect(pa.locator('.connection-banner')).toBeVisible({ timeout: 25000 });
    await expect(choice).toHaveCount(0);
    await pa.getByRole('button', { name: '나가기', exact: true }).click();
    await expect(pa.getByRole('dialog', { name: '대기실로 돌아갈까요?' })).toBeVisible();
    await pa.getByRole('button', { name: '계속 치기', exact: true }).click();
    await b.setOffline(false);
    await expect(choice).toBeVisible({ timeout: 15000 });
    await expect(pa.getByTestId('game-table')).toHaveAttribute('data-version', version!);
    await choice.getByRole('button', { name: /열끗으로 유지/ }).click();
    await expect(pa.getByTestId('game-table')).toHaveAttribute('data-phase', 'PLAY');
    await expect(pb.getByTestId('game-table')).toHaveAttribute('data-current', '1');
    await pa.getByRole('button', { name: '나가기', exact: true }).click();
    await pa.getByRole('button', { name: '대기실로', exact: true }).click();
    await expect(pb.getByRole('button', { name: '홈으로 돌아가기', exact: true })).toBeVisible();
    await expect(pc.getByRole('button', { name: '홈으로 돌아가기', exact: true })).toBeVisible();
    await pb.getByRole('button', { name: '홈으로 돌아가기', exact: true }).click();
    await expect(pb.getByRole('button', { name: /혼자 치기/ })).toBeVisible();
    await expect(pb.locator('.error-toast')).toHaveCount(0);
  } finally {
    await room.close();
    await env.cleanup();
  }
});
