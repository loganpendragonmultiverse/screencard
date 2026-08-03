import { describe, expect, it } from 'vitest';
import {
  clearToken,
  getCached,
  getNotes,
  getToken,
  getWatchlist,
  setCached,
  setNote,
  setToken,
  toggleWatchlist,
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
