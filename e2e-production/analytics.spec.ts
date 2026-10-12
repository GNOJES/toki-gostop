import { test, expect } from '@playwright/test';
test.use({ serviceWorkers: 'block' });

test('GA4 production collects starts and normal ends without invitation data or exit events', async ({
  page,
  context,
}) => {
  test.setTimeout(120000);
  // Serve the production build under its real origin, but never contact Google or production.
  await context.route('https://toki-matgo.vercel.app/**', async (route) => {
    const url = new URL(route.request().url());
    const response = await route.fetch({
      url: `http://127.0.0.1:3003${url.pathname}${url.search}`,
    });
    await route.fulfill({ response });
  });
  let tags = 0;
  await context.route('https://www.googletagmanager.com/**', async (route) => {
    tags++;
    await route.fulfill({ contentType: 'application/javascript', body: '' });
  });
  await context.route(/https:\/\/[^/]*google-analytics\.com\//, (route) => route.abort());
  await context.addInitScript(() => {
    localStorage.setItem(
      'toki.preferences.v1',
      JSON.stringify({ speed: 'fast', difficulty: 'easy', sound: false, haptic: false }),
    );
    let seed = 12345;
    const original = crypto.getRandomValues.bind(crypto);
    Object.defineProperty(crypto, 'getRandomValues', {
      value: (array: ArrayBufferView) => {
        if (!(array instanceof Uint32Array)) return original(array);
        for (let i = 0; i < array.length; i++) {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          array[i] = seed;
        }
        return array;
      },
    });
  });
  const events = () =>
    page.evaluate(() =>
      ((window as unknown as { dataLayer: ArrayLike<unknown>[] }).dataLayer ?? [])
        .map((c) => Array.from(c))
        .filter((c) => c[0] === 'event'),
    );
  await page.goto('https://toki-matgo.vercel.app/?source=test');
  await expect.poll(() => tags).toBe(1);
  await page.getByRole('button', { name: /혼자 치기/ }).click();
  await expect.poll(events).toEqual([['event', 'game_start', { game_mode: 'single' }]]);
  await page.getByRole('button', { name: '게임 시작', exact: true }).click();
  await page.getByRole('button', { name: '나가기', exact: true }).click();
  await page
    .getByRole('dialog', { name: '대기실로 돌아갈까요?' })
    .getByRole('button', { name: '대기실로', exact: true })
    .click();
  expect(await events()).toHaveLength(1);
  await page.getByRole('button', { name: /혼자 치기/ }).click();
  await page.getByRole('button', { name: '게임 시작', exact: true }).click();
  const table = page.getByTestId('game-table');
  for (let turn = 0; turn < 90; turn++) {
    await expect
      .poll(
        async () =>
          (await table.getAttribute('data-phase')) === 'FINISHED' ||
          ((await table.getAttribute('data-can-act')) === 'true' &&
            (await table.getAttribute('data-busy')) === 'false'),
        { timeout: 10000 },
      )
      .toBe(true);
    const phase = await table.getAttribute('data-phase');
    if (phase === 'FINISHED') break;
    const before = await table.getAttribute('data-version');
    if (phase === 'SELECT_KUKJIN') await page.getByRole('button', { name: /쌍피로 사용/ }).click();
    else if (phase === 'GO_STOP')
      await page.getByRole('button', { name: '스톱 이번 판을 마쳐요' }).click();
    else if (phase === 'SELECT_FLOOR') await page.locator('.floor-choices button').first().click();
    else {
      const hand = page.locator('.hand-card[aria-disabled="false"]');
      if (await hand.count()) {
        await hand.first().click();
        const plain = page.getByRole('button', { name: '한 장만 그냥 내기' });
        if (await plain.isVisible()) await plain.click();
      } else
        await page
          .getByRole('button', { name: /폭탄패 사용/ })
          .first()
          .click();
    }
    await expect(table).not.toHaveAttribute('data-version', before!);
  }
  await expect(table).toHaveAttribute('data-phase', 'FINISHED');
  await expect.poll(events).toEqual([
    ['event', 'game_start', { game_mode: 'single' }],
    ['event', 'game_start', { game_mode: 'single' }],
    ['event', 'game_end', { game_mode: 'single' }],
  ]);
  const commands = await page.evaluate(() =>
    (window as unknown as { dataLayer: ArrayLike<unknown>[] }).dataLayer.map((c) => Array.from(c)),
  );
  expect(JSON.stringify(commands)).not.toContain('source=test');
});
