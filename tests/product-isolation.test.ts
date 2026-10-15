import { it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
it('keeps original application caches untouched during activation', async () => {
  const deleted: string[] = [];
  const handlers: Record<string, Function> = {};
  vm.runInNewContext(await readFile('public/sw.js', 'utf8'), {
    URL,
    Response,
    Map,
    Set,
    caches: {
      open: async () => ({ match: async () => Response.json({ cards: {} }) }),
      keys: async () => [
        'toki-old-a',
        'toki-old-b',
        'toki-gostop-obsolete-a',
        'toki-gostop-obsolete-b',
      ],
      delete: async (n: string) => {
        deleted.push(n);
      },
    },
    self: {
      location: { origin: 'https://gostop.invalid' },
      clients: { claim: async () => {}, matchAll: async () => [] },
      addEventListener: (k: string, fn: Function) => (handlers[k] = fn),
    },
  });
  let work: Promise<void> = Promise.resolve();
  handlers.activate({ waitUntil: (p: Promise<void>) => (work = p) });
  await work;
  expect(deleted).not.toContain('toki-old-a');
  expect(deleted).not.toContain('toki-old-b');
  expect(deleted).toContain('toki-gostop-obsolete-a');
});
