import { getCached, setCached } from './storage';
import type { MediaDetails, MediaType, SearchResult } from './types';

const API_ROOT = 'https://api.themoviedb.org/3';
export const IMAGE_ROOT = 'https://image.tmdb.org/t/p';

const request = async <T>(
  path: string,
  token: string,
  store: Storage,
  valid?: (data: T) => boolean,
): Promise<T> => {
  const cached = getCached<T>(store, path);
  if (cached && (!valid || valid(cached))) return cached;
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
  if (valid && !valid(data))
    throw new Error('TMDB returned invalid search page data. Please retry.');
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

export interface SearchPage {
  results: SearchResult[];
  page: number;
  totalPages: number;
}

// Bound navigation and retain only one page in the interface.
export const MAX_SEARCH_PAGE = 500;

export const searchMediaPage = async (
  query: string,
  token: string,
  store: Storage,
  page = 1,
): Promise<SearchPage> => {
  if (!Number.isInteger(page) || page < 1 || page > MAX_SEARCH_PAGE)
    throw new Error('Search page must be an integer from 1 to 500.');
  const path = `/search/multi?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=${page}`;
  type Payload = { results: unknown[]; page?: number; total_pages?: number };
  const valid = (data: Payload): boolean =>
    Boolean(
      data &&
      Array.isArray(data.results) &&
      (data.page === undefined || data.page === page) &&
      (data.total_pages === undefined ||
        (Number.isInteger(data.total_pages) &&
          data.total_pages >= 0 &&
          page <= Math.max(1, data.total_pages))),
    );
  const response = await request<Payload>(path, token, store, valid);
  const totalPages = Math.max(1, Math.min(MAX_SEARCH_PAGE, response.total_pages ?? 1));
  return { results: normalizeSearchResults(response.results), page, totalPages };
};

export const searchMedia = async (
  query: string,
  token: string,
  store: Storage,
): Promise<SearchResult[]> => (await searchMediaPage(query, token, store)).results;

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
