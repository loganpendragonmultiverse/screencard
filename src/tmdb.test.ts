import { afterEach, describe, expect, it, vi } from 'vitest';
import { memoryStorage } from './testUtils';
import {
  dateOf,
  directorsOf,
  getMediaDetails,
  imageUrl,
  normalizeSearchResults,
  searchMedia,
  titleOf,
  trailerOf,
  yearOf,
} from './tmdb';
import type { MediaDetails } from './types';

const media = (): MediaDetails => ({
  id: 1,
  media_type: 'movie',
  title: 'Arrival',
  overview: 'A linguist meets visitors.',
  poster_path: '/poster.jpg',
  backdrop_path: null,
  release_date: '2016-11-11',
  vote_average: 8,
  genres: [{ id: 1, name: 'Science Fiction' }],
  runtime: 116,
  status: 'Released',
  tagline: 'Why are they here?',
  homepage: '',
  credits: {
    cast: [],
    crew: [
      { id: 1, name: 'Denis Villeneuve', job: 'Director' },
      { id: 2, name: 'Producer', job: 'Producer' },
    ],
  },
  videos: {
    results: [{ key: 'abc', name: 'Trailer', site: 'YouTube', type: 'Trailer', official: true }],
  },
});

afterEach(() => vi.unstubAllGlobals());

describe('TMDB client helpers', () => {
  it('normalizes movie and TV results and ignores people', () => {
    expect(
      normalizeSearchResults([
        { ...media(), media_type: 'movie' },
        { ...media(), id: 2, media_type: 'tv', name: 'Severance' },
        { id: 3, media_type: 'person' },
      ]),
    ).toHaveLength(2);
  });

  it('formats titles, years, images, credits, and trailers', () => {
    const item = media();
    expect(titleOf(item)).toBe('Arrival');
    expect(dateOf(item)).toBe('2016-11-11');
    expect(yearOf(item)).toBe('2016');
    expect(imageUrl(item.poster_path)).toContain('/w500/poster.jpg');
    expect(imageUrl(null)).toBe('');
    expect(directorsOf(item)).toEqual(['Denis Villeneuve']);
    expect(trailerOf(item)).toContain('watch?v=abc');
  });

  it('searches, filters, and caches results', async () => {
    const store = memoryStorage();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ results: [media(), { id: 2, media_type: 'person' }] }), {
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(searchMedia('Arrival', 'token', store)).resolves.toHaveLength(1);
    await expect(searchMedia('Arrival', 'token', store)).resolves.toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('loads details and reports authentication and rate errors', async () => {
    const store = memoryStorage();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(media()), { status: 200 })),
    );
    await expect(getMediaDetails('movie', 1, 'token', store)).resolves.toMatchObject({
      media_type: 'movie',
    });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })));
    await expect(searchMedia('bad', 'token', store)).rejects.toThrow('rejected');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 429 })));
    await expect(searchMedia('busy', 'token', store)).rejects.toThrow('rate limit');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })));
    await expect(searchMedia('broken', 'token', store)).rejects.toThrow('(500)');
  });
});
