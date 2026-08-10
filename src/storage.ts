import type {
  CacheRecord,
  ComparisonSet,
  LibraryEntry,
  LibraryState,
  MediaRef,
  MediaType,
  ScreenCardBackup,
} from './types';

const CACHE_PREFIX = 'screencard:cache:';
const LEGACY_WATCHLIST_KEY = 'screencard:watchlist:v1';
const NOTES_KEY = 'screencard:notes:v1';
const TOKEN_KEY = 'screencard:tmdb-token';
const LIBRARY_KEY = 'screencard:library:v2';
const COMPARISONS_KEY = 'screencard:comparisons:v1';
export const DEFAULT_LIST_ID = 'default';
export const MAX_CACHE_AGE = 1000 * 60 * 60 * 24;

const readJson = <T>(store: Storage, key: string, fallback: T): T => {
  try {
    const value = store.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
};

const validRef = (item: MediaRef): boolean =>
  Number.isInteger(item.id) &&
  (item.mediaType === 'movie' || item.mediaType === 'tv') &&
  Number.isFinite(item.addedAt);

const defaultLibrary = (): LibraryState => ({
  version: 2,
  lists: [{ id: DEFAULT_LIST_ID, name: 'Watchlist', createdAt: 0 }],
  entries: [],
});

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

export const getLibrary = (store: Storage): LibraryState => {
  const stored = readJson<LibraryState | null>(store, LIBRARY_KEY, null);
  if (stored?.version === 2 && Array.isArray(stored.lists) && Array.isArray(stored.entries)) {
    const lists = stored.lists.filter(
      (list) => typeof list.id === 'string' && typeof list.name === 'string',
    );
    if (!lists.some((list) => list.id === DEFAULT_LIST_ID)) {
      lists.unshift({ id: DEFAULT_LIST_ID, name: 'Watchlist', createdAt: 0 });
    }
    const listIds = new Set(lists.map((list) => list.id));
    const entries = stored.entries.filter(validRef).map((entry) => ({
      ...entry,
      listIds: [...new Set(Array.isArray(entry.listIds) ? entry.listIds : [])].filter((id) =>
        listIds.has(id),
      ),
      tags: [
        ...new Set(Array.isArray(entry.tags) ? entry.tags.map((tag) => tag.trim()) : []),
      ].filter(Boolean),
    }));
    return { version: 2, lists, entries };
  }
  const migrated = defaultLibrary();
  migrated.entries = readJson<MediaRef[]>(store, LEGACY_WATCHLIST_KEY, [])
    .filter(validRef)
    .map((item) => ({
      ...item,
      listIds: [DEFAULT_LIST_ID],
      status: 'want-to-watch',
      priority: 'normal',
      personalRating: null,
      tags: [],
    }));
  if (migrated.entries.length) store.setItem(LIBRARY_KEY, JSON.stringify(migrated));
  return migrated;
};

export const saveLibrary = (store: Storage, library: LibraryState): void => {
  store.setItem(LIBRARY_KEY, JSON.stringify(library));
};

export const getWatchlist = (store: Storage): MediaRef[] =>
  getLibrary(store).entries.map(({ id, mediaType, addedAt }) => ({ id, mediaType, addedAt }));

export const toggleWatchlist = (
  store: Storage,
  id: number,
  mediaType: MediaType,
  now = Date.now(),
): MediaRef[] => {
  const library = getLibrary(store);
  const exists = library.entries.some((item) => item.id === id && item.mediaType === mediaType);
  library.entries = exists
    ? library.entries.filter((item) => item.id !== id || item.mediaType !== mediaType)
    : [
        ...library.entries,
        {
          id,
          mediaType,
          addedAt: now,
          listIds: [DEFAULT_LIST_ID],
          status: 'want-to-watch',
          priority: 'normal',
          personalRating: null,
          tags: [],
        },
      ];
  saveLibrary(store, library);
  return getWatchlist(store);
};

export const createList = (store: Storage, name: string, now = Date.now()): LibraryState => {
  const library = getLibrary(store);
  const clean = name.trim();
  if (!clean) throw new Error('List name is required.');
  if (library.lists.some((list) => list.name.toLocaleLowerCase() === clean.toLocaleLowerCase())) {
    throw new Error('A list with that name already exists.');
  }
  library.lists.push({ id: `list-${now}`, name: clean, createdAt: now });
  saveLibrary(store, library);
  return library;
};

export const updateLibraryEntry = (
  store: Storage,
  key: string,
  changes: Partial<Omit<LibraryEntry, 'id' | 'mediaType' | 'addedAt'>>,
): LibraryState => {
  const library = getLibrary(store);
  const entry = library.entries.find((item) => `${item.mediaType}:${item.id}` === key);
  if (!entry) throw new Error('Library entry was not found.');
  Object.assign(entry, changes);
  saveLibrary(store, library);
  return library;
};

export const getNotes = (store: Storage): Record<string, string> =>
  readJson<Record<string, string>>(store, NOTES_KEY, {});

export const setNote = (store: Storage, key: string, note: string): void => {
  const notes = getNotes(store);
  if (note.trim()) notes[key] = note;
  else delete notes[key];
  store.setItem(NOTES_KEY, JSON.stringify(notes));
};

export const getComparisonSets = (store: Storage): ComparisonSet[] =>
  readJson<ComparisonSet[]>(store, COMPARISONS_KEY, []).filter(
    (item) =>
      typeof item.id === 'string' &&
      typeof item.name === 'string' &&
      Array.isArray(item.media) &&
      item.media.every(
        (ref) => Number.isInteger(ref.id) && (ref.mediaType === 'movie' || ref.mediaType === 'tv'),
      ),
  );

export const saveComparisonSet = (
  store: Storage,
  name: string,
  media: Array<Pick<MediaRef, 'id' | 'mediaType'>>,
  now = Date.now(),
): ComparisonSet[] => {
  const clean = name.trim();
  if (!clean) throw new Error('Comparison name is required.');
  const sets = getComparisonSets(store).filter(
    (set) => set.name.toLocaleLowerCase() !== clean.toLocaleLowerCase(),
  );
  sets.push({ id: `comparison-${now}`, name: clean, savedAt: now, media });
  store.setItem(COMPARISONS_KEY, JSON.stringify(sets));
  return sets;
};

export const buildBackup = (
  store: Storage,
  exportedAt = new Date().toISOString(),
): ScreenCardBackup => ({
  format: 'screencard-backup',
  version: 2,
  exportedAt,
  library: getLibrary(store),
  notes: getNotes(store),
  comparisonSets: getComparisonSets(store),
});

export interface MergePreview {
  newEntries: number;
  updatedEntries: number;
  newLists: number;
  noteConflicts: string[];
  comparisonConflicts: string[];
}

export const previewBackupMerge = (store: Storage, backup: ScreenCardBackup): MergePreview => {
  if (backup.format !== 'screencard-backup' || backup.version !== 2) {
    throw new Error('Unsupported ScreenCard backup.');
  }
  const library = getLibrary(store);
  const entryKeys = new Set(library.entries.map((item) => `${item.mediaType}:${item.id}`));
  const listNames = new Set(library.lists.map((item) => item.name.toLocaleLowerCase()));
  const notes = getNotes(store);
  const comparisonNames = new Set(
    getComparisonSets(store).map((item) => item.name.toLocaleLowerCase()),
  );
  return {
    newEntries: backup.library.entries.filter(
      (item) => !entryKeys.has(`${item.mediaType}:${item.id}`),
    ).length,
    updatedEntries: backup.library.entries.filter((item) =>
      entryKeys.has(`${item.mediaType}:${item.id}`),
    ).length,
    newLists: backup.library.lists.filter((item) => !listNames.has(item.name.toLocaleLowerCase()))
      .length,
    noteConflicts: Object.keys(backup.notes).filter(
      (key) => Boolean(notes[key]) && notes[key] !== backup.notes[key],
    ),
    comparisonConflicts: backup.comparisonSets
      .filter((item) => comparisonNames.has(item.name.toLocaleLowerCase()))
      .map((item) => item.name),
  };
};

export const mergeBackup = (store: Storage, backup: ScreenCardBackup): MergePreview => {
  const preview = previewBackupMerge(store, backup);
  const current = getLibrary(store);
  const listMap = new Map(current.lists.map((list) => [list.name.toLocaleLowerCase(), list.id]));
  for (const list of backup.library.lists) {
    if (!listMap.has(list.name.toLocaleLowerCase())) {
      current.lists.push(list);
      listMap.set(list.name.toLocaleLowerCase(), list.id);
    }
  }
  const incomingListNames = new Map(
    backup.library.lists.map((list) => [list.id, list.name.toLocaleLowerCase()]),
  );
  for (const entry of backup.library.entries) {
    const listIds = entry.listIds
      .map((id) => listMap.get(incomingListNames.get(id) ?? ''))
      .filter((id): id is string => Boolean(id));
    const mapped = { ...entry, listIds };
    const index = current.entries.findIndex(
      (item) => item.id === entry.id && item.mediaType === entry.mediaType,
    );
    if (index >= 0) current.entries[index] = mapped;
    else current.entries.push(mapped);
  }
  saveLibrary(store, current);
  store.setItem(NOTES_KEY, JSON.stringify({ ...getNotes(store), ...backup.notes }));
  const incomingNames = new Set(backup.comparisonSets.map((set) => set.name.toLocaleLowerCase()));
  store.setItem(
    COMPARISONS_KEY,
    JSON.stringify([
      ...getComparisonSets(store).filter((set) => !incomingNames.has(set.name.toLocaleLowerCase())),
      ...backup.comparisonSets,
    ]),
  );
  return preview;
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
