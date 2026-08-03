import type { CacheRecord, MediaRef, MediaType } from './types';

const CACHE_PREFIX = 'screencard:cache:';
const WATCHLIST_KEY = 'screencard:watchlist:v1';
const NOTES_KEY = 'screencard:notes:v1';
const TOKEN_KEY = 'screencard:tmdb-token';
export const MAX_CACHE_AGE = 1000 * 60 * 60 * 24;

const readJson = <T>(store: Storage, key: string, fallback: T): T => {
  try {
    const value = store.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
};

export const cacheKey = (path: string): string => `${CACHE_PREFIX}${path}`;

export const getCached = <T>(store: Storage, key: string, now = Date.now()): T | null => {
  const record = readJson<CacheRecord<T> | null>(store, cacheKey(key), null);
  if (!record || record.expiresAt <= now) {
    store.removeItem(cacheKey(key));
    return null;
  }
  return record.data;
};

export const setCached = <T>(store: Storage, key: string, data: T, now = Date.now()): void => {
  const record: CacheRecord<T> = { savedAt: now, expiresAt: now + MAX_CACHE_AGE, data };
  store.setItem(cacheKey(key), JSON.stringify(record));
};

export const getWatchlist = (store: Storage): MediaRef[] =>
  readJson<MediaRef[]>(store, WATCHLIST_KEY, []).filter(
    (item) =>
      Number.isInteger(item.id) &&
      (item.mediaType === 'movie' || item.mediaType === 'tv') &&
      Number.isFinite(item.addedAt),
  );

export const toggleWatchlist = (
  store: Storage,
  id: number,
  mediaType: MediaType,
  now = Date.now(),
): MediaRef[] => {
  const current = getWatchlist(store);
  const exists = current.some((item) => item.id === id && item.mediaType === mediaType);
  const next = exists
    ? current.filter((item) => item.id !== id || item.mediaType !== mediaType)
    : [...current, { id, mediaType, addedAt: now }];
  store.setItem(WATCHLIST_KEY, JSON.stringify(next));
  return next;
};

export const getNotes = (store: Storage): Record<string, string> =>
  readJson<Record<string, string>>(store, NOTES_KEY, {});

export const setNote = (store: Storage, key: string, note: string): void => {
  const notes = getNotes(store);
  if (note.trim()) notes[key] = note;
  else delete notes[key];
  store.setItem(NOTES_KEY, JSON.stringify(notes));
};

export const getToken = (session: Storage, local: Storage): string =>
  session.getItem(TOKEN_KEY) ?? local.getItem(TOKEN_KEY) ?? '';

export const setToken = (
  session: Storage,
  local: Storage,
  token: string,
  remember: boolean,
): void => {
  session.setItem(TOKEN_KEY, token);
  if (remember) local.setItem(TOKEN_KEY, token);
  else local.removeItem(TOKEN_KEY);
};

export const clearToken = (session: Storage, local: Storage): void => {
  session.removeItem(TOKEN_KEY);
  local.removeItem(TOKEN_KEY);
};
