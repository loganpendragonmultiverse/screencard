import { describe, expect, it } from 'vitest';
import { exportLibraryCsv, matchesLibraryQuery } from './library';
import { demoCards, localReference } from './research';
import type { LibraryEntry, LibraryState, MediaDetails } from './types';

const entry: LibraryEntry = {
  id: -9001,
  mediaType: 'movie',
  addedAt: 1,
  listIds: ['watchlist'],
  status: 'want-to-watch',
  priority: 'high',
  personalRating: 0,
  tags: ['Family Night', 'coast'],
};
const library: LibraryState = {
  version: 2,
  lists: [{ id: 'watchlist', name: 'Weekend, "friends"', createdAt: 1 }],
  entries: [entry],
};
const card = demoCards[0]!;

describe('local library search', () => {
  it('matches all terms across title and tags, ignoring case and whitespace', () => {
    expect(matchesLibraryQuery(card, entry, '  LANTERN   family  ')).toBe(true);
    expect(matchesLibraryQuery(card, entry, 'lantern missing')).toBe(false);
    expect(matchesLibraryQuery(card, entry, '   ')).toBe(true);
    expect(matchesLibraryQuery(card, entry, 'movie:-9001')).toBe(true);
  });
  it('finds uncached references by ID and keeps movie and TV IDs distinct', () => {
    const ref = localReference({ id: 42, mediaType: 'tv', addedAt: 1 });
    const saved = { ...entry, id: 42, mediaType: 'tv' as const };
    expect(matchesLibraryQuery(ref, saved, 'tv:42')).toBe(true);
    expect(matchesLibraryQuery(ref, saved, 'movie:42')).toBe(false);
  });
});

describe('visible library CSV', () => {
  it('exports only supplied saved cards in order with accurate metadata and no notes by default', () => {
    const csv = exportLibraryCsv([card, demoCards[1]!], library, {
      'movie:-9001': 'PRIVATE-CANARY',
    });
    expect(csv).toContain('"high","0","Family Night; coast","Weekend, ""friends""",""');
    expect(csv).not.toContain('PRIVATE-CANARY');
    expect(csv).not.toContain('Private note');
    expect(csv).not.toContain('Signals at Dawn');
    expect(csv.split('\r\n')).toHaveLength(3);
  });
  it('includes notes only by opt-in and escapes commas, quotes and newlines', () => {
    const csv = exportLibraryCsv(
      [card],
      library,
      { 'movie:-9001': 'Hello, "friends"\nNext line' },
      true,
    );
    expect(csv).toContain('"Private note"');
    expect(csv).toContain('"Hello, ""friends""\nNext line"');
    expect(exportLibraryCsv([], library)).toBe(
      '"Title","Type","Year","Status","Priority","Personal rating","Tags","Lists","TMDB URL"\r\n',
    );
  });
  it.each([
    '=1+1',
    '+CMD',
    '-1+1',
    '@SUM(A1)',
    '  =HYPERLINK("bad")',
    '\tformula',
    '\rformula',
    '\nformula',
  ])('neutralizes spreadsheet formulas in every textual field: %j', (value) => {
    const media: MediaDetails = { ...card, title: value };
    const csv = exportLibraryCsv(
      [media],
      {
        ...library,
        lists: [{ ...library.lists[0]!, name: value }],
        entries: [{ ...entry, tags: [value] }],
      },
      { 'movie:-9001': value },
      true,
    );
    expect(csv.match(/"'/g)).toHaveLength(4);
  });
  it('links real media to the correct TMDB type, leaves missing ratings blank and keeps the input unchanged', () => {
    const real = { ...card, id: 42, media_type: 'tv' as const, name: 'Series' };
    const state = {
      ...library,
      entries: [{ ...entry, id: 42, mediaType: 'tv' as const, personalRating: null }],
    };
    const before = JSON.stringify(state);
    expect(exportLibraryCsv([real], state)).toContain('https://www.themoviedb.org/tv/42');
    expect(exportLibraryCsv([real], state)).toContain('"high","","Family Night; coast"');
    expect(JSON.stringify(state)).toBe(before);
  });
});
