import { afterEach, describe, expect, it, vi } from 'vitest';
import { memoryStorage } from './testUtils';
import {
  dateOf,
  directorsOf,
  getMediaDetails,
  imageUrl,
  normalizeSearchResults,
  searchMedia,
  searchMediaPage,
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

describe('paged search', () => {
  it('encodes queries, separates cached pages and filters people without hiding pagination', async () => {
    const store = memoryStorage();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ page: 1, total_pages: 3, results: [media()] })),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ page: 2, total_pages: 3, results: [{ id: 7, media_type: 'person' }] }),
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    expect(await searchMediaPage('A & B?', 'synthetic', store)).toMatchObject({
      page: 1,
      totalPages: 3,
      results: [media()],
    });
    expect(await searchMediaPage('A & B?', 'synthetic', store, 2)).toEqual({
      page: 2,
      totalPages: 3,
      results: [],
    });
    await searchMediaPage('A & B?', 'synthetic', store, 1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('query=A%20%26%20B%3F'),
      expect.objectContaining({
        headers: { Authorization: 'Bearer synthetic', Accept: 'application/json' },
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('page=2'),
      expect.anything(),
    );
  });

  it.each([0, -1, 1.5, 501, NaN, Infinity])(
    'rejects invalid page %s without fetching',
    async (page) => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      await expect(searchMediaPage('title', 'synthetic', memoryStorage(), page)).rejects.toThrow(
        'integer',
      );
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('bounds excessive totals and represents a zero-result search as page one', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ page: 1, total_pages: 1000, results: [] })),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ page: 1, total_pages: 0, results: [] })),
      );
    vi.stubGlobal('fetch', fetchMock);
    expect((await searchMediaPage('many', 'synthetic', memoryStorage())).totalPages).toBe(500);
    expect(await searchMediaPage('none', 'synthetic', memoryStorage())).toEqual({
      page: 1,
      totalPages: 1,
      results: [],
    });
  });

  it.each([
    null,
    {},
    { results: {} },
    { results: [], page: 2, total_pages: 3 },
    { results: [], total_pages: -1 },
    { results: [], total_pages: 2.5 },
  ])('does not cache malformed page metadata', async (payload) => {
    const store = memoryStorage();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(payload)))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ results: [media()], page: 1, total_pages: 2 })),
      );
    vi.stubGlobal('fetch', fetchMock);
    await expect(searchMediaPage('retry', 'synthetic', store)).rejects.toThrow(
      'invalid search page',
    );
    expect((await searchMediaPage('retry', 'synthetic', store)).results).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps a cached first page after a later-page error and permits retry', async () => {
    const store = memoryStorage();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ results: [media()], page: 1, total_pages: 2 })),
      )
      .mockResolvedValueOnce(new Response('', { status: 429 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ results: [], page: 2, total_pages: 2 })),
      );
    vi.stubGlobal('fetch', fetchMock);
    await searchMediaPage('retry', 'synthetic', store);
    await expect(searchMediaPage('retry', 'synthetic', store, 2)).rejects.toThrow('rate limit');
    expect((await searchMediaPage('retry', 'synthetic', store)).results).toHaveLength(1);
    expect((await searchMediaPage('retry', 'synthetic', store, 2)).page).toBe(2);
  });
});
