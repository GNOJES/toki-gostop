import { test, expect } from '@playwright/test';
test('animation failure restores readiness without reloading', async ({ browser }) => {
  const a = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  const b = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  const pa = await a.newPage(),
    pb = await b.newPage();
  try {
    await pa.goto('/');
    await pa.getByRole('button', { name: /친구와 치기/ }).click();
    await pa.getByLabel('내 이름').fill('auditA');
    await pa.getByRole('button', { name: '방 만들기', exact: true }).click();
    const code = await pa.getByTestId('room-code').innerText();
    await pb.goto('/?room=' + code);
    await pb.getByLabel('내 이름').fill('auditB');
    await pb.getByRole('button', { name: '참여하기', exact: true }).click();
    await expect(pa.getByTestId('game-table')).toHaveAttribute('data-busy', 'false');
    await expect(pb.getByTestId('game-table')).toBeVisible();
    const actor =
      (await pa.getByTestId('game-table').getAttribute('data-current')) === '0' ? pa : pb;
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
    // The other screen can still show the previous turn when recovery finishes.
    // Wait for both committed views before selecting the next actor.
    await expect
      .poll(async () => {
        const left = await pa
          .getByTestId('game-table')
          .evaluate((el) => ({ ...(el as HTMLElement).dataset }));
        const right = await pb
          .getByTestId('game-table')
          .evaluate((el) => ({ ...(el as HTMLElement).dataset }));
        return (
          left.version === right.version &&
          left.current === right.current &&
          left.busy === 'false' &&
          right.busy === 'false' &&
          (left.canAct === 'true' || right.canAct === 'true')
        );
      })
      .toBe(true);
    const nextActor =
      (await pa.getByTestId('game-table').getAttribute('data-can-act')) === 'true' ? pa : pb;
    const before = await nextActor.getByTestId('game-table').getAttribute('data-version');
    const phase = await nextActor.getByTestId('game-table').getAttribute('data-phase');
    if (phase === 'SELECT_FLOOR') await nextActor.locator('.floor-choices button').first().click();
    else if (phase === 'SELECT_KUKJIN')
      await nextActor.getByRole('button', { name: /쌍피로 사용/ }).click();
    else if (phase === 'GO_STOP')
      await nextActor.getByRole('button', { name: '스톱 이번 판을 마쳐요' }).click();
    else {
      await nextActor.locator('.hand-card').first().click();
      const plain = nextActor.getByRole('button', { name: '한 장만 그냥 내기' });
      if (await plain.isVisible()) await plain.click();
    }
    await expect(nextActor.getByTestId('game-table')).not.toHaveAttribute('data-version', before!);
  } finally {
    await a.close();
    await b.close();
  }
});
