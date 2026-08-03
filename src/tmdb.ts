import { getCached, setCached } from './storage';
import type { MediaDetails, MediaType, SearchResult } from './types';

const API_ROOT = 'https://api.themoviedb.org/3';
export const IMAGE_ROOT = 'https://image.tmdb.org/t/p';

const request = async <T>(path: string, token: string, store: Storage): Promise<T> => {
  const cached = getCached<T>(store, path);
  if (cached) return cached;
  const response = await fetch(`${API_ROOT}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!response.ok) {
    if (response.status === 401)
      throw new Error('TMDB rejected this token. Check your API Read Access Token.');
    if (response.status === 429)
      throw new Error('TMDB rate limit reached. Wait a moment and try again.');
    throw new Error(`TMDB request failed (${response.status}).`);
  }
  const data = (await response.json()) as T;
  setCached(store, path, data);
  return data;
};

export const normalizeSearchResults = (results: unknown[]): SearchResult[] =>
  results.filter((item): item is SearchResult =>
    Boolean(
      item &&
      typeof item === 'object' &&
      ((item as SearchResult).media_type === 'movie' ||
        (item as SearchResult).media_type === 'tv') &&
      Number.isInteger((item as SearchResult).id),
    ),
  );

export const searchMedia = async (
  query: string,
  token: string,
  store: Storage,
): Promise<SearchResult[]> => {
  const path = `/search/multi?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`;
  const response = await request<{ results: unknown[] }>(path, token, store);
  return normalizeSearchResults(response.results);
};

export const getMediaDetails = (
  mediaType: MediaType,
  id: number,
  token: string,
  store: Storage,
): Promise<MediaDetails> =>
  request<MediaDetails>(
    `/${mediaType}/${id}?language=en-US&append_to_response=credits,videos`,
    token,
    store,
  ).then((media) => ({ ...media, media_type: mediaType }));

export const titleOf = (media: SearchResult): string => media.title ?? media.name ?? 'Untitled';
export const dateOf = (media: SearchResult): string =>
  media.release_date ?? media.first_air_date ?? '';
export const yearOf = (media: SearchResult): string => dateOf(media).slice(0, 4) || '—';
export const imageUrl = (path: string | null, size = 'w500'): string =>
  path ? `${IMAGE_ROOT}/${size}${path}` : '';

export const directorsOf = (media: MediaDetails): string[] =>
  media.credits.crew
    .filter((credit) => credit.job === 'Director' || credit.job === 'Executive Producer')
    .slice(0, 3)
    .map((credit) => credit.name);

export const trailerOf = (media: MediaDetails): string | null => {
  const video =
    media.videos.results.find(
      (item) => item.site === 'YouTube' && item.type === 'Trailer' && item.official,
    ) ?? media.videos.results.find((item) => item.site === 'YouTube' && item.type === 'Trailer');
  return video ? `https://www.youtube.com/watch?v=${encodeURIComponent(video.key)}` : null;
};
