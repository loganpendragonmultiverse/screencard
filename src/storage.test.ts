import { describe, expect, it } from 'vitest';
import {
  buildBackup,
  clearToken,
  createList,
  getCached,
  getLibrary,
  getNotes,
  getToken,
  getWatchlist,
  mergeBackup,
  previewBackupMerge,
  saveComparisonSet,
  setCached,
  setNote,
  setToken,
  toggleWatchlist,
  updateLibraryEntry,
} from './storage';
import { memoryStorage } from './testUtils';

describe('local ScreenCard state', () => {
  it('caches values until the explicit expiration', () => {
    const store = memoryStorage();
    setCached(store, 'movie/1', { title: 'Arrival' }, 100);
    expect(getCached(store, 'movie/1', 101)).toEqual({ title: 'Arrival' });
    expect(getCached(store, 'movie/1', Number.MAX_SAFE_INTEGER)).toBeNull();
  });

  it('toggles a minimal watchlist reference without storing media payloads', () => {
    const store = memoryStorage();
    expect(toggleWatchlist(store, 10, 'movie', 123)).toEqual([
      { id: 10, mediaType: 'movie', addedAt: 123 },
    ]);
    expect(toggleWatchlist(store, 10, 'movie', 124)).toEqual([]);
    store.setItem('screencard:watchlist:v1', '[{"bad":true}]');
    expect(getWatchlist(store)).toEqual([]);
  });

  it('organizes entries with local metadata and named lists', () => {
    const store = memoryStorage();
    toggleWatchlist(store, 10, 'movie', 123);
    createList(store, 'Family night', 200);
    updateLibraryEntry(store, 'movie:10', {
      listIds: ['list-200'],
      status: 'watched',
      priority: 'high',
      personalRating: 8.5,
      tags: ['family', 'favorite'],
    });
    expect(getLibrary(store).entries[0]).toMatchObject({
      status: 'watched',
      priority: 'high',
      personalRating: 8.5,
      tags: ['family', 'favorite'],
    });
  });

  it('previews conflicts before merging versioned backups', () => {
    const source = memoryStorage();
    toggleWatchlist(source, 10, 'movie', 123);
    setNote(source, 'movie:10', 'Incoming note');
    saveComparisonSet(source, 'Weekend', [{ id: 10, mediaType: 'movie' }], 200);
    const backup = buildBackup(source, '2026-08-10T00:00:00Z');

    const target = memoryStorage();
    toggleWatchlist(target, 10, 'movie', 100);
    setNote(target, 'movie:10', 'Existing note');
    saveComparisonSet(target, 'Weekend', [{ id: 20, mediaType: 'tv' }], 100);
    expect(previewBackupMerge(target, backup)).toMatchObject({
      newEntries: 0,
      updatedEntries: 1,
      noteConflicts: ['movie:10'],
      comparisonConflicts: ['Weekend'],
    });
    mergeBackup(target, backup);
    expect(getNotes(target)['movie:10']).toBe('Incoming note');
  });

  it('stores and removes local notes', () => {
    const store = memoryStorage();
    setNote(store, 'movie:1', 'Compare the sound design.');
    expect(getNotes(store)).toEqual({ 'movie:1': 'Compare the sound design.' });
    setNote(store, 'movie:1', '');
    expect(getNotes(store)).toEqual({});
  });

  it('supports session-only and remembered tokens', () => {
    const session = memoryStorage();
    const local = memoryStorage();
    setToken(session, local, 'abc', false);
    expect(getToken(session, local)).toBe('abc');
    setToken(session, local, 'def', true);
    session.clear();
    expect(getToken(session, local)).toBe('def');
    clearToken(session, local);
    expect(getToken(session, local)).toBe('');
  });

  it('recovers from malformed local JSON', () => {
    const store = memoryStorage();
    store.setItem('screencard:notes:v1', '{');
    expect(getNotes(store)).toEqual({});
  });
});
