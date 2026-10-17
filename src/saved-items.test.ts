import { expect, it } from 'vitest';
import {
  createList,
  deleteList,
  renameList,
  getLibrary,
  updateLibraryEntry,
  setNote,
  getNotes,
  saveComparisonSet,
  getComparisonSets,
  renameComparisonSet,
  deleteComparisonSet,
  toggleWatchlist,
} from './storage';
import {
  columns,
  preferences,
  savePreferences,
  renameSavedFilter,
  deleteSavedFilter,
  resolveLocalDetails,
  demoCards,
} from './research';
import { setCached } from './storage';
import { memoryStorage } from './testUtils';

it('renames custom lists without changing identity or memberships and rejects conflicts', () => {
  const s = memoryStorage();
  createList(s, 'Weekend', 1);
  createList(s, 'Family', 2);
  toggleWatchlist(s, 99, 'movie', 3);
  updateLibraryEntry(s, 'movie:99', { listIds: ['list-1'], tags: ['keep'], personalRating: 8 });
  renameList(s, 'list-1', ' Evening ');
  expect(getLibrary(s).lists.find((l) => l.id === 'list-1')?.name).toBe('Evening');
  expect(getLibrary(s).entries[0]).toMatchObject({
    listIds: ['list-1'],
    tags: ['keep'],
    personalRating: 8,
  });
  const before = s.getItem('screencard:library:v2');
  for (const [id, name] of [
    ['default', 'Other'],
    ['list-1', 'family'],
    ['missing', 'Title'],
    ['list-1', ' '],
  ])
    expect(() => renameList(s, id!, name!)).toThrow();
  expect(s.getItem('screencard:library:v2')).toBe(before);
});
it('deletes only list membership, retains other lists or falls back to Watchlist, and preserves notes', () => {
  const s = memoryStorage();
  createList(s, 'Weekend', 1);
  createList(s, 'Family', 2);
  for (const id of [1, 2]) toggleWatchlist(s, id, 'movie', id);
  updateLibraryEntry(s, 'movie:1', { listIds: ['list-1'], status: 'watched', tags: ['keep'] });
  updateLibraryEntry(s, 'movie:2', { listIds: ['list-1', 'list-2'], priority: 'high' });
  setNote(s, 'movie:1', 'private');
  deleteList(s, 'list-1');
  expect(getLibrary(s).entries).toMatchObject([
    { id: 1, listIds: ['default'], status: 'watched', tags: ['keep'] },
    { id: 2, listIds: ['list-2'], priority: 'high' },
  ]);
  expect(getNotes(s)['movie:1']).toBe('private');
  const before = s.getItem('screencard:library:v2');
  expect(() => deleteList(s, 'default')).toThrow();
  expect(() => deleteList(s, 'missing')).toThrow();
  expect(s.getItem('screencard:library:v2')).toBe(before);
});
it('renames/deletes saved comparison sets without changing library or notes', () => {
  const s = memoryStorage();
  toggleWatchlist(s, 99, 'movie', 1);
  setNote(s, 'movie:99', 'private');
  saveComparisonSet(s, 'One', [{ id: 99, mediaType: 'movie' }], 1);
  saveComparisonSet(s, 'Two', [], 2);
  const library = s.getItem('screencard:library:v2');
  renameComparisonSet(s, 'comparison-1', 'First');
  expect(getComparisonSets(s)[0]).toMatchObject({
    id: 'comparison-1',
    name: 'First',
    media: [{ id: 99, mediaType: 'movie' }],
  });
  expect(() => renameComparisonSet(s, 'comparison-1', 'two')).toThrow();
  expect(() => renameComparisonSet(s, 'missing', 'Name')).toThrow();
  deleteComparisonSet(s, 'comparison-1');
  expect(getComparisonSets(s).map((x) => x.name)).toEqual(['Two']);
  expect(() => deleteComparisonSet(s, 'missing')).toThrow();
  expect(s.getItem('screencard:library:v2')).toBe(library);
  expect(getNotes(s)['movie:99']).toBe('private');
});
it('renames/deletes saved views and releases a slot without changing columns or library data', () => {
  const s = memoryStorage();
  savePreferences(
    s,
    ['runtime'],
    Array.from({ length: 30 }, (_, i) => ({
      name: `View ${i}`,
      list: 'all',
      status: 'watched',
      tag: 'family',
      sort: 'title',
    })),
  );
  renameSavedFilter(s, 'View 0', 'First');
  expect(preferences(s).filters[0]).toMatchObject({
    name: 'First',
    status: 'watched',
    tag: 'family',
  });
  expect(() => renameSavedFilter(s, 'First', 'view 1')).toThrow();
  expect(() => renameSavedFilter(s, 'missing', 'Name')).toThrow();
  deleteSavedFilter(s, 'First');
  expect(preferences(s).filters).toHaveLength(29);
  expect(preferences(s).columns).toEqual(['runtime']);
  expect(() => deleteSavedFilter(s, 'missing')).toThrow();
  expect(s.getItem('screencard:library:v2')).toBeNull();
});
it('keeps successful provider details unchanged and reports no fallback warning', async () => {
  const s = memoryStorage(),
    ref = { id: 99, mediaType: 'movie' as const, addedAt: 1 };
  const media = { ...demoCards[0]!, id: 99 };
  expect(await resolveLocalDetails(s, ref, async () => media)).toEqual({
    media,
    label: 'Fresh TMDB details',
    warning: '',
  });
});
it('uses stale cached details after a failed refresh without changing saved bytes', async () => {
  const s = memoryStorage(),
    ref = { id: 99, mediaType: 'movie' as const, addedAt: 1 };
  setCached(
    s,
    '/movie/99?language=en-US&append_to_response=credits,videos',
    { ...demoCards[0]!, id: 99 },
    1,
  );
  const before = s.getItem(
    'screencard:cache:/movie/99?language=en-US&append_to_response=credits,videos',
  );
  const result = await resolveLocalDetails(s, ref, async () => {
    throw new Error('503');
  });
  expect(result.media.id).toBe(99);
  expect(result.label).toContain('Refresh failed · Stale cached');
  expect(result.warning).toContain('TMDB refresh failed');
  expect(
    s.getItem('screencard:cache:/movie/99?language=en-US&append_to_response=credits,videos'),
  ).toBe(before);
});
it('falls back per reference on rejection while keeping successful siblings and uncached references usable', async () => {
  const s = memoryStorage();
  const result = await Promise.all(
    [99, 100].map((id) =>
      resolveLocalDetails(s, { id, mediaType: 'movie', addedAt: 1 }, async () => {
        if (id === 99) throw new Error('401');
        return { ...demoCards[0]!, id };
      }),
    ),
  );
  expect(result[0]!.media.title).toContain('Movie #99');
  expect(result[0]!.label).toContain('Local reference');
  expect(result[1]!.media.title).toContain('fictional demo');
  expect(result[1]!.warning).toBe('');
  expect(preferences(s).columns).toEqual(columns);
});
