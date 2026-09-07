import { expect, it } from 'vitest';
import {
  detailCache,
  demoCards,
  localReference,
  preferences,
  savePreferences,
  columns,
} from './research';
import { buildBackup, setCached, setToken, setNote, toggleWatchlist } from './storage';
import { memoryStorage } from './testUtils';
it('persists validated columns and filter preferences without unrelated properties', () => {
  const store = memoryStorage();
  expect(preferences(store).columns).toEqual(columns);
  savePreferences(
    store,
    ['runtime'],
    [{ name: 'Weekend', list: 'all', status: 'watched', tag: 'family', sort: 'title' }],
  );
  expect(preferences(store)).toMatchObject({
    columns: ['runtime'],
    filters: [{ name: 'Weekend' }],
  });
  store.setItem(
    'screencard:research-preferences:v1',
    '{"columns":["password","rating"],"filters":[null,{}]}',
  );
  expect(preferences(store)).toEqual({ columns: ['rating'], filters: [] });
  store.setItem('screencard:research-preferences:v1', '{');
  expect(preferences(store).columns).toEqual(columns);
});
it('labels stale detail cache without requiring a network token', () => {
  const store = memoryStorage(),
    ref = { id: demoCards[0]!.id, mediaType: 'movie' as const, addedAt: 1 };
  expect(detailCache(store, ref)).toBeNull();
  setCached(
    store,
    `/movie/${ref.id}?language=en-US&append_to_response=credits,videos`,
    demoCards[0],
    100,
  );
  expect(detailCache(store, ref, 200)?.label).toContain('Cached');
  expect(detailCache(store, ref, 200_000_000)?.label).toContain('Stale cached');
  expect(localReference({ ...ref, id: 123 }).title).toContain('123');
  expect(demoCards.every((card) => card.id < 0 && card.poster_path === null)).toBe(true);
});
it('omits private notes, cache and stored tokens from a share backup', () => {
  const store = memoryStorage(),
    session = memoryStorage();
  setToken(session, store, 'TOKEN-CANARY', true);
  setNote(store, 'movie:1', 'PRIVATE-NOTE');
  setCached(store, 'sample', { private: 'CACHE-CANARY' });
  toggleWatchlist(store, 1, 'movie', 1);
  const json = JSON.stringify(buildBackup(store, '2026-09-07', false));
  expect(json).not.toContain('TOKEN-CANARY');
  expect(json).not.toContain('CACHE-CANARY');
  expect(json).not.toContain('PRIVATE-NOTE');
  expect(buildBackup(store, '2026-09-07', true).notes['movie:1']).toBe('PRIVATE-NOTE');
});
it('evicts oldest cached responses at 100 while preserving the token', () => {
  const store = memoryStorage();
  store.setItem('screencard:tmdb-token', 'token');
  for (let i = 0; i < 101; i++) setCached(store, `test/${i}`, { id: i }, i);
  expect(store.getItem('screencard:cache:test/0')).toBeNull();
  expect(store.getItem('screencard:cache:test/100')).not.toBeNull();
  expect(store.getItem('screencard:tmdb-token')).toBe('token');
});
