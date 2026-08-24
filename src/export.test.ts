import { describe, expect, it } from 'vitest';
import { ATTRIBUTION, buildExport, exportJson, exportMarkdown } from './export';
import type { MediaDetails } from './types';

const card: MediaDetails = {
  id: 42,
  media_type: 'tv',
  name: 'A Series',
  overview: 'An overview.',
  poster_path: null,
  backdrop_path: null,
  first_air_date: '2024-01-01',
  vote_average: 7.5,
  genres: [{ id: 1, name: 'Drama' }],
  number_of_seasons: 2,
  number_of_episodes: 16,
  status: 'Returning Series',
  tagline: '',
  homepage: '',
  credits: { cast: [], crew: [{ id: 1, name: 'Lead Producer', job: 'Executive Producer' }] },
  videos: { results: [] },
};

describe('portable research exports', () => {
  it('builds versioned JSON with notes and attribution', () => {
    const bundle = buildExport(
      [card],
      { 'tv:42': 'Watch before the finale.' },
      '2026-08-03T00:00:00Z',
    );
    expect(JSON.parse(exportJson(bundle))).toMatchObject({
      format: 'screencard-research',
      version: 1,
    });
    expect(bundle.cards[0]?.note).toBe('Watch before the finale.');
    expect(bundle.attribution).toBe(ATTRIBUTION);
  });

  it('writes a readable Markdown comparison', () => {
    const markdown = exportMarkdown(buildExport([card], {}));
    expect(markdown).toContain('# ScreenCard research export');
    expect(markdown).toContain('2 seasons / 16 episodes');
    expect(markdown).toContain(ATTRIBUTION);
  });

  it('can omit private notes from a shareable export', () => {
    const bundle = buildExport(
      [card],
      { 'tv:42': 'Private detail' },
      '2026-08-10T00:00:00Z',
      false,
    );
    expect(bundle.cards[0]).not.toHaveProperty('note');
    expect(exportMarkdown(bundle)).not.toContain('Private detail');
  });
});
