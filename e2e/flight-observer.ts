import type { Page } from '@playwright/test';

export interface FlightRecord {
  kind: string;
  card: string;
  from: [number, number];
  to: [number, number];
  deck: [number, number];
  ownPi: [number, number];
  opponentCard: [number, number] | null;
  floorBonus: boolean;
  effect: string;
  effectFont: number;
}

/** Record transient geometry inside the browser, before screenshots or runner delays. */
export async function observeFlights(page: Page) {
  await page.evaluate(() => {
    const records: FlightRecord[] = [];
    (window as unknown as { observedFlights: FlightRecord[] }).observedFlights = records;
    const seen = new WeakSet<Element>();
    new MutationObserver(() => {
      const el = document.querySelector<HTMLElement>('.card-motion');
      if (!el || seen.has(el)) return;
      const board = document.querySelector('.floor-area')!.getBoundingClientRect();
      const center = (target: Element | null): [number, number] | null => {
        if (!target) return null;
        const r = target.getBoundingClientRect();
        return [r.left + r.width / 2, r.top + r.height / 2];
      };
      const piles = [
        document.querySelector('.opponent-panel .captured')!,
        document.querySelector('.own-panel .captured')!,
      ];
      const style = el.style;
      const width = parseFloat(style.getPropertyValue('--motion-width'));
      const height = parseFloat(style.getPropertyValue('--motion-height'));
      const card = el.dataset.movingCardId ?? '';
      const endpoint = (which: string): [number, number] => [
        parseFloat(style.getPropertyValue(`--${which}-x`)) + width / 2 + board.left,
        parseFloat(style.getPropertyValue(`--${which}-y`)) + height / 2 + board.top,
      ];
      const effect = document.querySelector('.turn-message.callout');
      records.push({
        kind: el.className,
        card,
        from: endpoint('from'),
        to: endpoint('to'),
        deck: center(document.querySelector('.deck .hwatu'))!,
        ownPi: center(piles[1].querySelectorAll('.captured-group')[3])!,
        opponentCard: center(piles[0].querySelector(`[data-captured-card-id="${card}"] .hwatu`)),
        floorBonus: !!document.querySelector('[data-floor-card-id="bonus-0"]'),
        effect: effect?.textContent ?? '',
        effectFont: effect ? parseFloat(getComputedStyle(effect).fontSize) : 0,
      });
      seen.add(el);
    }).observe(document.body, { subtree: true, childList: true, attributes: true });
  });
}
export async function recordedFlight(page: Page, kind: string, card: string) {
  return page.evaluate(
    ({ kind, card }) =>
      (window as unknown as { observedFlights: FlightRecord[] }).observedFlights.find(
        (r) => r.kind.split(' ').includes(kind) && r.card === card,
      ),
    { kind, card },
  );
}
