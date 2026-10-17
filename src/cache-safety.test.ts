import { afterEach, expect, it, vi } from 'vitest';
import { getCached, setCached } from './storage';
import { getMediaDetails, searchMedia } from './tmdb';
import { memoryStorage } from './testUtils';
afterEach(() => vi.unstubAllGlobals());
const wrap = (base: Storage, setItem: Storage['setItem']): Storage => ({
  get length() {
    return base.length;
  },
  key: (i) => base.key(i),
  getItem: (key) => base.getItem(key),
  removeItem: (key) => base.removeItem(key),
  clear: () => base.clear(),
  setItem,
});

it('returns successful provider responses when an optional cache write cannot fit', async () => {
  const base = memoryStorage();
  base.setItem('screencard:tmdb-token', 'SYNTHETIC-NOT-A-CREDENTIAL');
  base.setItem('screencard:notes:v1', '{"movie:1":"private fixture"}');
  const before = Array.from({ length: base.length }, (_, i) => [
    base.key(i),
    base.getItem(base.key(i)!),
  ]);
  const store = wrap(base, () => {
    throw new DOMException('Synthetic storage quota', 'QuotaExceededError');
  });
  const movie = { id: 1, media_type: 'movie', title: 'Fixture movie' };
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [movie] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(movie), { status: 200 })),
  );
  await expect(searchMedia('fixture', 'SYNTHETIC-NOT-A-CREDENTIAL', store)).resolves.toHaveLength(
    1,
  );
  await expect(
    getMediaDetails('movie', 1, 'SYNTHETIC-NOT-A-CREDENTIAL', store),
  ).resolves.toMatchObject(movie);
  expect(
    Array.from({ length: base.length }, (_, i) => [base.key(i), base.getItem(base.key(i)!)]),
  ).toEqual(before);
});

it('evicts only the oldest own cache entries when quota requires space', () => {
  const base = memoryStorage();
  base.setItem('screencard:library:v2', 'private library fixture');
  base.setItem('screencard:notes:v1', 'private notes fixture');
  base.setItem('screencard:tmdb-token', 'SYNTHETIC-NOT-A-CREDENTIAL');
  setCached(base, 'old-a', { id: 1 }, 1);
  setCached(base, 'old-b', { id: 2 }, 2);
  const store = wrap(base, (key, value) => {
    const count = Array.from({ length: base.length }, (_, i) => base.key(i)).filter((k) =>
      k?.startsWith('screencard:cache:'),
    ).length;
    if (!base.getItem(key) && count >= 2)
      throw new DOMException('Synthetic storage quota', 'QuotaExceededError');
    base.setItem(key, value);
  });
  expect(() => setCached(store, 'new', { id: 3 }, 3)).not.toThrow();
  expect(base.getItem('screencard:cache:old-a')).toBeNull();
  expect(getCached(base, 'old-b', 4)).toEqual({ id: 2 });
  expect(getCached(base, 'new', 4)).toEqual({ id: 3 });
  expect(base.getItem('screencard:library:v2')).toBe('private library fixture');
  expect(base.getItem('screencard:notes:v1')).toBe('private notes fixture');
  expect(base.getItem('screencard:tmdb-token')).toBe('SYNTHETIC-NOT-A-CREDENTIAL');
});

it('does not evict cache or private data for non-quota storage failures', () => {
  const base = memoryStorage();
  setCached(base, 'existing', { id: 1 }, 1);
  const before = base.getItem('screencard:cache:existing');
  const store = wrap(base, () => {
    throw new DOMException('Synthetic blocked storage', 'SecurityError');
  });
  expect(() => setCached(store, 'new', { id: 2 }, 2)).not.toThrow();
  expect(base.getItem('screencard:cache:existing')).toBe(before);
});

it('keeps the own-cache entry bound at 100', () => {
  const store = memoryStorage();
  for (let i = 0; i < 101; i++) setCached(store, String(i), { id: i }, i);
  expect(store.length).toBe(100);
  expect(store.getItem('screencard:cache:0')).toBeNull();
  expect(getCached(store, '100', 102)).toEqual({ id: 100 });
});
