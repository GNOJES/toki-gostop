import { expect, type Browser, type Page } from '@playwright/test';
export async function friendTable(browser: Browser) {
  const contexts = await Promise.all(
    [0, 1, 2].map(() =>
      browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        reducedMotion: 'reduce',
      }),
    ),
  );
  const pages = await Promise.all(contexts.map((c) => c.newPage()));
  for (const c of contexts)
    await c.addInitScript(() =>
      localStorage.setItem(
        'toki-gostop.preferences.v1',
        JSON.stringify({ speed: 'fast', difficulty: 'easy', sound: false, haptic: false }),
      ),
    );
  await pages[0].goto('/');
  await pages[0].getByRole('button', { name: /친구와 치기/ }).click();
  await pages[0].getByLabel('내 이름').fill('지훈');
  await pages[0].getByRole('button', { name: '방 만들기', exact: true }).click();
  const code = await pages[0].getByTestId('room-code').innerText();
  for (const [i, name] of [
    [1, '민수'],
    [2, '영희'],
  ] as const) {
    await pages[i].goto(`/?room=${code}`);
    await pages[i].getByLabel('내 이름').fill(name);
    await pages[i].getByRole('button', { name: '참여하기', exact: true }).click();
    if (i === 1) await expect(pages[0].getByTestId('game-table')).toHaveCount(0);
  }
  for (const p of pages) await expect(p.getByTestId('game-table')).toBeVisible();
  return { contexts, pages, code, close: () => Promise.all(contexts.map((c) => c.close())) };
}
export async function synchronized(pages: Page[]) {
  await expect
    .poll(async () => {
      const states = await Promise.all(
        pages.map((p) =>
          p.getByTestId('game-table').evaluate((el) => ({ ...(el as HTMLElement).dataset })),
        ),
      );
      return states.every(
        (s) =>
          s.version === states[0].version && s.current === states[0].current && s.busy === 'false',
      );
    })
    .toBe(true);
}
export async function actCurrent(pages: Page[]) {
  await synchronized(pages);
  const current = Number(await pages[0].getByTestId('game-table').getAttribute('data-current'));
  const page = pages[current],
    table = page.getByTestId('game-table');
  if ((await table.getAttribute('data-phase')) === 'FINISHED') return false;
  await expect(table).toHaveAttribute('data-can-act', 'true');
  const phase = await table.getAttribute('data-phase'),
    version = await table.getAttribute('data-version');
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
  await expect(table).not.toHaveAttribute('data-version', version!);
  return true;
}
export async function readBrowserHistory(page: Page) {
  return page.evaluate(
    () =>
      new Promise<any>((resolve, reject) => {
        const r = indexedDB.open('toki-gostop-history-v1');
        r.onsuccess = () => {
          const db = r.result,
            tx = db.transaction('history'),
            q = tx.objectStore('history').get('current');
          q.onsuccess = () => resolve(q.result);
          tx.oncomplete = () => db.close();
        };
        r.onerror = () => reject(r.error);
      }),
  );
}
