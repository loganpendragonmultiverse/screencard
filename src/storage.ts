import type {
  CacheRecord,
  ComparisonSet,
  LibraryEntry,
  LibraryState,
  MediaRef,
  MediaType,
  ScreenCardBackup,
  SavedList,
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

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const strings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');
const validRef = (item: unknown): item is MediaRef =>
  record(item) &&
  Number.isInteger(item.id) &&
  (item.mediaType === 'movie' || item.mediaType === 'tv') &&
  Number.isFinite(item.addedAt);
const validList = (item: unknown): item is SavedList =>
  record(item) &&
  typeof item.id === 'string' &&
  Boolean(item.id.trim()) &&
  typeof item.name === 'string' &&
  Boolean(item.name.trim()) &&
  Number.isFinite(item.createdAt);
const statuses = ['want-to-watch', 'watching', 'watched', 'paused', 'skipped'];
const priorities = ['low', 'normal', 'high'];
const validEntry = (item: unknown): item is LibraryEntry =>
  validRef(item) &&
  record(item) &&
  strings(item.listIds) &&
  strings(item.tags) &&
  statuses.includes(String(item.status)) &&
  priorities.includes(String(item.priority)) &&
  (item.personalRating === null ||
    (typeof item.personalRating === 'number' &&
      Number.isFinite(item.personalRating) &&
      item.personalRating >= 0 &&
      item.personalRating <= 10));
const validComparison = (item: unknown): item is ComparisonSet =>
  record(item) &&
  typeof item.id === 'string' &&
  Boolean(item.id.trim()) &&
  typeof item.name === 'string' &&
  Boolean(item.name.trim()) &&
  Number.isFinite(item.savedAt) &&
  Array.isArray(item.media) &&
  item.media.length <= 4 &&
  item.media.every(
    (ref: unknown) =>
      record(ref) &&
      Number.isInteger(ref.id) &&
      (ref.mediaType === 'movie' || ref.mediaType === 'tv'),
  );
const unique = (values: string[]): boolean => new Set(values).size === values.length;
const unusedId = (desired: string, ids: Set<string>): string => {
  let result = desired;
  let suffix = 2;
  while (ids.has(result)) result = `${desired}-${suffix++}`;
  return result;
};
function assertBackup(value: unknown): asserts value is ScreenCardBackup {
  if (
    !record(value) ||
    value.format !== 'screencard-backup' ||
    value.version !== 2 ||
    typeof value.exportedAt !== 'string' ||
    !record(value.library) ||
    value.library.version !== 2 ||
    !Array.isArray(value.library.lists) ||
    !value.library.lists.every(validList) ||
    !Array.isArray(value.library.entries) ||
    !value.library.entries.every(validEntry) ||
    !record(value.notes) ||
    !Object.values(value.notes).every((note) => typeof note === 'string') ||
    !Array.isArray(value.comparisonSets) ||
    !value.comparisonSets.every(validComparison)
  ) {
    throw new Error('Unsupported or invalid ScreenCard backup. No local data was changed.');
  }
  const lists = value.library.lists;
  const entries = value.library.entries;
  const listIds = new Set(lists.map((list) => list.id));
  if (
    !unique(lists.map((list) => list.id)) ||
    !unique(lists.map((list) => list.name.toLocaleLowerCase())) ||
    !unique(entries.map((entry) => `${entry.mediaType}:${entry.id}`)) ||
    entries.some((entry) => entry.listIds.some((id) => !listIds.has(id))) ||
    !unique(value.comparisonSets.map((set) => set.id)) ||
    !unique(value.comparisonSets.map((set) => set.name.toLocaleLowerCase()))
  ) {
    throw new Error(
      'Backup contains duplicate identities or unknown lists. No local data was changed.',
    );
  }
}

const defaultLibrary = (): LibraryState => ({
  version: 2,
  lists: [{ id: DEFAULT_LIST_ID, name: 'Watchlist', createdAt: 0 }],
  entries: [],
});

export const cacheKey = (path: string): string => `${CACHE_PREFIX}${path}`;

export const getCached = <T>(store: Storage, key: string, now = Date.now()): T | null => {
  const record = readJson<CacheRecord<T> | null>(store, cacheKey(key), null);
  if (!record || !Number.isFinite(record.expiresAt) || record.expiresAt <= now) {
    return null;
  }
  return record.data;
};

export const setCached = <T>(store: Storage, key: string, data: T, now = Date.now()): void => {
  // A cache is optional: storage pressure must not discard a valid provider response.
  try {
    const target = cacheKey(key);
    const value = JSON.stringify({ savedAt: now, expiresAt: now + MAX_CACHE_AGE, data });
    const others = Array.from({ length: store.length }, (_, i) => store.key(i)).filter(
      (item): item is string => Boolean(item?.startsWith(CACHE_PREFIX)) && item !== target,
    );
    others.sort(
      (a, b) =>
        (readJson<CacheRecord<unknown> | null>(store, a, null)?.savedAt ?? 0) -
        (readJson<CacheRecord<unknown> | null>(store, b, null)?.savedAt ?? 0),
    );
    const write = (): boolean => {
      try {
        store.setItem(target, value);
        return true;
      } catch (error) {
        if (
          !record(error) ||
          !['QuotaExceededError', 'NS_ERROR_DOM_QUOTA_REACHED'].includes(String(error.name))
        )
          throw error;
        return false;
      }
    };
    let saved = write();
    while (!saved && others.length) {
      store.removeItem(others.shift()!);
      saved = write();
    }
    if (saved) {
      for (const old of others.slice(0, Math.max(0, others.length - 99))) store.removeItem(old);
    }
  } catch {
    // Never evict library, note or token keys, and never fail a successful fetch.
  }
};

export const getLibrary = (store: Storage): LibraryState => {
  let source: string | null;
  try {
    source = store.getItem(LIBRARY_KEY);
  } catch {
    return defaultLibrary();
  }
  let stored: LibraryState | null = null;
  try {
    stored = source === null ? null : (JSON.parse(source) as LibraryState);
  } catch {
    /* Preserve malformed source. */
  }
  if (stored?.version === 2) {
    const lists = (Array.isArray(stored.lists) ? stored.lists : [])
      .filter(validList)
      .filter((list, index, all) => all.findIndex((other) => other.id === list.id) === index);
    if (!lists.some((list) => list.id === DEFAULT_LIST_ID)) {
      lists.unshift({ id: DEFAULT_LIST_ID, name: 'Watchlist', createdAt: 0 });
    }
    const listIds = new Set(lists.map((list) => list.id));
    const entries = (Array.isArray(stored.entries) ? stored.entries : [])
      .filter(validRef)
      .map((entry) => ({
        ...entry,
        listIds: [...new Set(Array.isArray(entry.listIds) ? entry.listIds : [])].filter((id) =>
          listIds.has(id),
        ),
        tags: [
          ...new Set(
            Array.isArray(entry.tags)
              ? entry.tags
                  .filter((tag): tag is string => typeof tag === 'string')
                  .map((tag) => tag.trim())
              : [],
          ),
        ].filter(Boolean),
        status: statuses.includes(entry.status) ? entry.status : ('want-to-watch' as const),
        priority: priorities.includes(entry.priority) ? entry.priority : ('normal' as const),
        personalRating:
          typeof entry.personalRating === 'number' &&
          Number.isFinite(entry.personalRating) &&
          entry.personalRating >= 0 &&
          entry.personalRating <= 10
            ? entry.personalRating
            : null,
      }));
    return { version: 2, lists, entries };
  }
  // Present v2 source, including malformed or unsupported data, is never replaced by a recovery read.
  if (source !== null) return defaultLibrary();
  const migrated = defaultLibrary();
  const legacy = readJson<unknown>(store, LEGACY_WATCHLIST_KEY, []);
  migrated.entries = (Array.isArray(legacy) ? legacy : []).filter(validRef).map((item) => ({
    ...item,
    listIds: [DEFAULT_LIST_ID],
    status: 'want-to-watch',
    priority: 'normal',
    personalRating: null,
    tags: [],
  }));
  if (migrated.entries.length) {
    try {
      // Migration is best effort and must not overwrite a v2 source created in the meantime.
      if (store.getItem(LIBRARY_KEY) === null) store.setItem(LIBRARY_KEY, JSON.stringify(migrated));
    } catch {
      /* Keep the usable legacy view when storage is full or blocked. */
    }
  }
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
  library.lists.push({
    id: unusedId(`list-${now}`, new Set(library.lists.map((list) => list.id))),
    name: clean,
    createdAt: now,
  });
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

export const getNotes = (store: Storage): Record<string, string> => {
  const value = readJson<unknown>(store, NOTES_KEY, {});
  return record(value)
    ? Object.fromEntries(
        Object.entries(value).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
      )
    : {};
};

export const setNote = (store: Storage, key: string, note: string): void => {
  const notes = getNotes(store);
  if (note.trim()) notes[key] = note;
  else delete notes[key];
  store.setItem(NOTES_KEY, JSON.stringify(notes));
};

export const getComparisonSets = (store: Storage): ComparisonSet[] => {
  const value = readJson<unknown>(store, COMPARISONS_KEY, []);
  return Array.isArray(value) ? value.filter(validComparison) : [];
};

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
  sets.push({
    id: unusedId(`comparison-${now}`, new Set(sets.map((set) => set.id))),
    name: clean,
    savedAt: now,
    media,
  });
  store.setItem(COMPARISONS_KEY, JSON.stringify(sets));
  return sets;
};

export const buildBackup = (
  store: Storage,
  exportedAt = new Date().toISOString(),
  includeNotes = true,
): ScreenCardBackup => ({
  format: 'screencard-backup',
  version: 2,
  exportedAt,
  library: {
    version: 2,
    lists: getLibrary(store).lists.map((list) => ({
      id: list.id,
      name: list.name,
      createdAt: list.createdAt,
    })),
    entries: getLibrary(store).entries.map((entry) => ({
      id: entry.id,
      mediaType: entry.mediaType,
      addedAt: entry.addedAt,
      listIds: entry.listIds,
      status: entry.status,
      priority: entry.priority,
      personalRating: entry.personalRating,
      tags: entry.tags,
    })),
  },
  notes: includeNotes ? getNotes(store) : {},
  comparisonSets: getComparisonSets(store).map((set) => ({
    id: set.id,
    name: set.name,
    savedAt: set.savedAt,
    media: set.media.map((ref) => ({ id: ref.id, mediaType: ref.mediaType })),
  })),
});

export interface MergePreview {
  newEntries: number;
  updatedEntries: number;
  newLists: number;
  noteConflicts: string[];
  comparisonConflicts: string[];
}

export const previewBackupMerge = (store: Storage, backup: ScreenCardBackup): MergePreview => {
  assertBackup(backup);
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
  const usedListIds = new Set(current.lists.map((list) => list.id));
  for (const list of backup.library.lists) {
    if (!listMap.has(list.name.toLocaleLowerCase())) {
      const id = unusedId(list.id, usedListIds);
      usedListIds.add(id);
      current.lists.push({ ...list, id });
      listMap.set(list.name.toLocaleLowerCase(), id);
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
  const incomingNames = new Set(backup.comparisonSets.map((set) => set.name.toLocaleLowerCase()));
  const comparisons = getComparisonSets(store).filter(
    (set) => !incomingNames.has(set.name.toLocaleLowerCase()),
  );
  const usedComparisonIds = new Set(comparisons.map((set) => set.id));
  for (const set of backup.comparisonSets) {
    const id = unusedId(set.id, usedComparisonIds);
    usedComparisonIds.add(id);
    comparisons.push({ ...set, id });
  }
  const writes = [
    [LIBRARY_KEY, JSON.stringify(current)],
    [NOTES_KEY, JSON.stringify({ ...getNotes(store), ...backup.notes })],
    [COMPARISONS_KEY, JSON.stringify(comparisons)],
  ] as const;
  const before = new Map<string, string | null>(writes.map(([key]) => [key, store.getItem(key)]));
  const written: Array<readonly [string, string]> = [];
  try {
    for (const [key, value] of writes) {
      store.setItem(key, value);
      written.push([key, value]);
    }
  } catch {
    let restored = true;
    for (const [key, value] of written.reverse()) {
      try {
        if (store.getItem(key) !== value) {
          restored = false;
          continue;
        }
        const old = before.get(key);
        if (old === null || old === undefined) store.removeItem(key);
        else store.setItem(key, old);
      } catch {
        restored = false;
      }
    }
    throw new Error(
      restored
        ? 'Backup save failed. Local data was restored; free browser storage and retry.'
        : 'Backup save failed and some local data could not be restored. Keep your backup and inspect the library before retrying.',
    );
  }

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
