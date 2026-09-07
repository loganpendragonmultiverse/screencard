import type { MediaDetails, MediaRef } from './types';
export const columns = ['rating', 'runtime', 'status', 'genres', 'directors', 'cast'] as const;
export type Column = (typeof columns)[number];
export const presets: Record<string, Column[]> = {
  complete: [...columns],
  quick: ['rating', 'runtime', 'genres'],
  credits: ['directors', 'cast', 'genres'],
};
export interface SavedFilter {
  name: string;
  list: string;
  status: string;
  tag: string;
  sort: string;
}
const key = 'screencard:research-preferences:v1';
export function preferences(store: Storage): { columns: Column[]; filters: SavedFilter[] } {
  try {
    const raw = JSON.parse(store.getItem(key) ?? '{}');
    return {
      columns: Array.isArray(raw.columns)
        ? columns.filter((c) => raw.columns.includes(c))
        : [...columns],
      filters: Array.isArray(raw.filters)
        ? raw.filters
            .filter(
              (f: SavedFilter) =>
                f &&
                ['name', 'list', 'status', 'tag', 'sort'].every(
                  (k) => typeof f[k as keyof SavedFilter] === 'string',
                ),
            )
            .slice(0, 30)
        : [],
    };
  } catch {
    return { columns: [...columns], filters: [] };
  }
}
export function savePreferences(store: Storage, selected: Column[], filters: SavedFilter[]) {
  store.setItem(
    key,
    JSON.stringify({
      version: 1,
      columns: columns.filter((c) => selected.includes(c)),
      filters: filters
        .slice(0, 30)
        .map((f) => ({ name: f.name, list: f.list, status: f.status, tag: f.tag, sort: f.sort })),
    }),
  );
}
export function detailCache(
  store: Storage,
  ref: Pick<MediaRef, 'id' | 'mediaType'>,
  now = Date.now(),
): { media: MediaDetails; label: string } | null {
  try {
    const value = JSON.parse(
      store.getItem(
        `screencard:cache:/${ref.mediaType}/${ref.id}?language=en-US&append_to_response=credits,videos`,
      ) ?? 'null',
    );
    if (
      !value ||
      !Number.isFinite(value.savedAt) ||
      !Number.isFinite(value.expiresAt) ||
      !value.data ||
      value.data.id !== ref.id ||
      !Array.isArray(value.data.genres) ||
      !value.data.credits ||
      !value.data.videos
    )
      return null;
    return {
      media: { ...value.data, media_type: ref.mediaType },
      label: `${value.expiresAt <= now ? 'Stale cached' : 'Cached'} details · ${Math.max(0, Math.floor((now - value.savedAt) / 3600000))} hours old`,
    };
  } catch {
    return null;
  }
}
export const demoCards: MediaDetails[] = [
  ['The Lantern Coast', 94, 'Adventure'],
  ['Signals at Dawn', 118, 'Drama'],
  ['A Small Observatory', 82, 'Documentary'],
].map(([title, runtime, genre], i) => ({
  id: -9001 - i,
  media_type: 'movie',
  title: `${title} (fictional demo)`,
  overview:
    'An invented example for exploring local lists, comparisons and exports. This is not TMDB data.',
  poster_path: null,
  backdrop_path: null,
  release_date: '2026-01-01',
  vote_average: 7 + i * 0.4,
  runtime: Number(runtime),
  genres: [{ id: i, name: String(genre) }],
  status: 'Demo',
  tagline: 'Offline sample',
  homepage: '',
  credits: { cast: [], crew: [] },
  videos: { results: [] },
}));
export function localReference(ref: MediaRef): MediaDetails {
  return {
    ...demoCards[0]!,
    id: ref.id,
    media_type: ref.mediaType,
    title: `${ref.mediaType === 'movie' ? 'Movie' : 'Series'} #${ref.id} — details not cached`,
    overview:
      'This local library reference remains editable. Connect a TMDB token to refresh its details.',
    vote_average: 0,
    runtime: null,
    genres: [],
    status: 'Not loaded',
    release_date: '',
  };
}
