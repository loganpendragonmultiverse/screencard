import { describe, expect, it } from 'vitest';
import {
  buildBackup,
  createList,
  getComparisonSets,
  getLibrary,
  getNotes,
  mergeBackup,
  previewBackupMerge,
  saveComparisonSet,
  setNote,
  toggleWatchlist,
  updateLibraryEntry,
} from './storage';
import type { ScreenCardBackup } from './types';
import { memoryStorage } from './testUtils';
const snapshot = (store: Storage): string =>
  JSON.stringify(
    Array.from({ length: store.length }, (_, i) => store.key(i))
      .sort()
      .map((key) => [key, store.getItem(key!)]),
  );

describe('local data and backup failure recovery', () => {
  it('reads usable persisted data without crashing or rewriting malformed records', () => {
    const store = memoryStorage();
    const good = {
      id: 1,
      mediaType: 'movie',
      addedAt: 1,
      listIds: ['default'],
      tags: [null, ' family '],
      status: 'broken',
      priority: 'broken',
      personalRating: 99,
    };
    store.setItem(
      'screencard:library:v2',
      JSON.stringify({ version: 2, lists: [null], entries: [null, good] }),
    );
    store.setItem(
      'screencard:notes:v1',
      JSON.stringify({ 'movie:1': 'preserved', 'movie:2': { invalid: true } }),
    );
    store.setItem('screencard:comparisons:v1', JSON.stringify([null, { id: 'bad' }]));
    const before = snapshot(store);
    expect(getLibrary(store).entries[0]).toMatchObject({
      tags: ['family'],
      status: 'want-to-watch',
      priority: 'normal',
      personalRating: null,
    });
    expect(getNotes(store)).toEqual({ 'movie:1': 'preserved' });
    expect(getComparisonSets(store)).toEqual([]);
    expect(snapshot(store)).toBe(before);
    store.setItem('screencard:library:v2', 'null');
    store.setItem('screencard:watchlist:v1', '{}');
    store.setItem('screencard:comparisons:v1', '{}');
    expect(getLibrary(store).entries).toEqual([]);
    expect(getComparisonSets(store)).toEqual([]);
    store.setItem('screencard:notes:v1', '[]');
    expect(getNotes(store)).toEqual({});
  });

  it('rejects malformed imports before preview or any local write', () => {
    const source = memoryStorage();
    toggleWatchlist(source, 1, 'movie', 1);
    const valid = buildBackup(source);
    const target = memoryStorage();
    setNote(target, 'movie:2', 'local note');
    const invalid: unknown[] = [
      null,
      {},
      { ...valid, notes: { 'movie:1': { invalid: true } } },
      { ...valid, comparisonSets: [null] },
      {
        ...valid,
        library: {
          ...valid.library,
          entries: [{ ...valid.library.entries[0], listIds: ['unknown'] }],
        },
      },
      {
        ...valid,
        library: { ...valid.library, entries: [{ ...valid.library.entries[0], tags: [null] }] },
      },
      {
        ...valid,
        library: { ...valid.library, lists: [...valid.library.lists, valid.library.lists[0]] },
      },
    ];
    for (const backup of invalid) {
      const before = snapshot(target);
      expect(() => previewBackupMerge(target, backup as ScreenCardBackup)).toThrow(
        /backup|identities/i,
      );
      expect(() => mergeBackup(target, backup as ScreenCardBackup)).toThrow(/backup|identities/i);
      expect(snapshot(target)).toBe(before);
    }
  });

  it('keeps imported list memberships and saved comparisons distinct when IDs collide', () => {
    const source = memoryStorage();
    createList(source, 'Incoming list', 200);
    toggleWatchlist(source, 1, 'movie', 1);
    updateLibraryEntry(source, 'movie:1', { listIds: ['list-200'] });
    saveComparisonSet(source, 'Incoming comparison', [{ id: 1, mediaType: 'movie' }], 200);
    const target = memoryStorage();
    createList(target, 'Existing list', 200);
    toggleWatchlist(target, 2, 'tv', 2);
    updateLibraryEntry(target, 'tv:2', { listIds: ['list-200'] });
    saveComparisonSet(target, 'Existing comparison', [{ id: 2, mediaType: 'tv' }], 200);
    const backup = buildBackup(source);
    const original = JSON.stringify(backup);
    mergeBackup(target, backup);
    const library = getLibrary(target);
    const incoming = library.lists.find((list) => list.name === 'Incoming list')!;
    const existing = library.lists.find((list) => list.name === 'Existing list')!;
    expect(incoming.id).not.toBe(existing.id);
    expect(library.entries.find((entry) => entry.id === 1)!.listIds).toEqual([incoming.id]);
    expect(library.entries.find((entry) => entry.id === 2)!.listIds).toEqual([existing.id]);
    const sets = getComparisonSets(target);
    expect(new Set(sets.map((set) => set.id)).size).toBe(2);
    expect(JSON.stringify(backup)).toBe(original);
  });

  it('allocates distinct local list and comparison IDs within one clock tick', () => {
    const store = memoryStorage();
    createList(store, 'First', 1);
    createList(store, 'Second', 1);
    expect(new Set(getLibrary(store).lists.map((list) => list.id)).size).toBe(3);
    saveComparisonSet(store, 'First', [], 1);
    saveComparisonSet(store, 'Second', [], 1);
    expect(new Set(getComparisonSets(store).map((set) => set.id)).size).toBe(2);
  });

  for (const failedKey of [
    'screencard:library:v2',
    'screencard:notes:v1',
    'screencard:comparisons:v1',
  ]) {
    it(`restores local data and supports retry after a write failure at ${failedKey}`, () => {
      const source = memoryStorage();
      toggleWatchlist(source, 1, 'movie', 1);
      setNote(source, 'movie:1', 'incoming');
      saveComparisonSet(source, 'Incoming', [{ id: 1, mediaType: 'movie' }], 1);
      const target = memoryStorage();
      toggleWatchlist(target, 2, 'tv', 2);
      setNote(target, 'tv:2', 'existing');
      const before = snapshot(target);
      const backup = buildBackup(source);
      let fail = true;
      const failing: Storage = {
        get length() {
          return target.length;
        },
        key: (i) => target.key(i),
        getItem: (key) => target.getItem(key),
        removeItem: (key) => target.removeItem(key),
        clear: () => target.clear(),
        setItem: (key, value) => {
          if (fail && key === failedKey) {
            fail = false;
            throw new Error('Synthetic quota failure');
          }
          target.setItem(key, value);
        },
      };
      expect(() => mergeBackup(failing, backup)).toThrow(/restored/);
      expect(snapshot(target)).toBe(before);
      expect(() => mergeBackup(failing, backup)).not.toThrow();
      expect(getNotes(target)['movie:1']).toBe('incoming');
      expect(getNotes(target)['tv:2']).toBe('existing');
    });
  }
  it('preserves an intervening change and reports incomplete rollback', () => {
    const source = memoryStorage();
    toggleWatchlist(source, 1, 'movie', 1);
    const target = memoryStorage();
    const changed = '{"version":2,"lists":[],"entries":[]}';
    const failing: Storage = {
      get length() {
        return target.length;
      },
      key: (i) => target.key(i),
      getItem: (key) => target.getItem(key),
      removeItem: (key) => target.removeItem(key),
      clear: () => target.clear(),
      setItem: (key, value) => {
        if (key === 'screencard:notes:v1') {
          target.setItem('screencard:library:v2', changed);
          throw new Error('Synthetic failure');
        }
        target.setItem(key, value);
      },
    };
    expect(() => mergeBackup(failing, buildBackup(source))).toThrow(/could not be restored/);
    expect(target.getItem('screencard:library:v2')).toBe(changed);
  });

  it('reports failed rollback without claiming local data was restored', () => {
    const target = memoryStorage();
    let rollback = false;
    const failing: Storage = {
      get length() {
        return target.length;
      },
      key: (i) => target.key(i),
      getItem: (key) => target.getItem(key),
      removeItem: (key) => {
        if (rollback) throw new Error('Synthetic rollback failure');
        target.removeItem(key);
      },
      clear: () => target.clear(),
      setItem: (key, value) => {
        if (key === 'screencard:notes:v1') {
          rollback = true;
          throw new Error('Synthetic quota failure');
        }
        target.setItem(key, value);
      },
    };
    expect(() => mergeBackup(failing, buildBackup(memoryStorage()))).toThrow(
      /could not be restored/,
    );
    expect(target.getItem('screencard:library:v2')).not.toBeNull();
  });
  it('recovers valid v2 entries independently of malformed lists without replacing source bytes', () => {
    const store = memoryStorage();
    const legacy = '[{"id":1,"mediaType":"tv","addedAt":1}]';
    const source = JSON.stringify({
      version: 2,
      lists: {},
      entries: [
        {
          id: 99,
          mediaType: 'movie',
          addedAt: 1,
          listIds: ['default'],
          status: 'watched',
          priority: 'high',
          personalRating: 9,
          tags: ['keep'],
        },
      ],
    });
    store.setItem('screencard:library:v2', source);
    store.setItem('screencard:watchlist:v1', legacy);
    expect(getLibrary(store).entries).toEqual([
      {
        id: 99,
        mediaType: 'movie',
        addedAt: 1,
        listIds: ['default'],
        status: 'watched',
        priority: 'high',
        personalRating: 9,
        tags: ['keep'],
      },
    ]);
    expect(store.getItem('screencard:library:v2')).toBe(source);
    expect(store.getItem('screencard:watchlist:v1')).toBe(legacy);
  });

  for (const failure of ['QuotaExceededError', 'SecurityError']) {
    it(`keeps valid legacy data usable when migration writes fail with ${failure}`, () => {
      const base = memoryStorage();
      const legacy = '[{"id":1,"mediaType":"tv","addedAt":1}]';
      base.setItem('screencard:watchlist:v1', legacy);
      const blocked: Storage = {
        get length() {
          return base.length;
        },
        key: (i) => base.key(i),
        getItem: (key) => base.getItem(key),
        removeItem: (key) => base.removeItem(key),
        clear: () => base.clear(),
        setItem: () => {
          throw new DOMException('Synthetic migration write failure', failure);
        },
      };
      expect(() => getLibrary(blocked)).not.toThrow();
      expect(getLibrary(blocked).entries[0]).toMatchObject({ id: 1, mediaType: 'tv' });
      expect(base.getItem('screencard:library:v2')).toBeNull();
      expect(base.getItem('screencard:watchlist:v1')).toBe(legacy);
    });
  }

  it('still saves the first valid legacy migration when v2 is absent and storage is writable', () => {
    const store = memoryStorage();
    const legacy = '[{"id":1,"mediaType":"tv","addedAt":1}]';
    store.setItem('screencard:watchlist:v1', legacy);
    const view = getLibrary(store);
    expect(view.entries[0]).toMatchObject({ id: 1, mediaType: 'tv' });
    expect(JSON.parse(store.getItem('screencard:library:v2')!)).toEqual(view);
    expect(store.getItem('screencard:watchlist:v1')).toBe(legacy);
  });

  it('never replaces present invalid or unsupported v2 source with retained legacy data', () => {
    for (const source of [
      '{broken',
      'null',
      '',
      JSON.stringify({ version: 999, lists: [], entries: [] }),
    ]) {
      const store = memoryStorage();
      store.setItem('screencard:library:v2', source);
      store.setItem('screencard:watchlist:v1', '[{"id":1,"mediaType":"tv","addedAt":1}]');
      expect(() => getLibrary(store)).not.toThrow();
      expect(store.getItem('screencard:library:v2')).toBe(source);
    }
  });
});
