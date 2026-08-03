import { dateOf, directorsOf, titleOf } from './tmdb';
import type { ExportBundle, MediaDetails } from './types';

export const ATTRIBUTION =
  'This product uses the TMDB API but is not endorsed or certified by TMDB.';

export const buildExport = (
  cards: MediaDetails[],
  notes: Record<string, string>,
  exportedAt = new Date().toISOString(),
): ExportBundle => ({
  format: 'screencard-research',
  version: 1,
  exportedAt,
  cards: cards.map((media) => ({
    media,
    note: notes[`${media.media_type}:${media.id}`] ?? '',
  })),
  attribution: ATTRIBUTION,
});

export const exportJson = (bundle: ExportBundle): string => JSON.stringify(bundle, null, 2);

export const exportMarkdown = (bundle: ExportBundle): string => {
  const lines = ['# ScreenCard research export', '', `Exported: ${bundle.exportedAt}`, ''];
  bundle.cards.forEach(({ media, note }) => {
    const runtime =
      media.media_type === 'movie'
        ? media.runtime
          ? `${media.runtime} minutes`
          : 'Unknown'
        : `${media.number_of_seasons ?? '—'} seasons / ${media.number_of_episodes ?? '—'} episodes`;
    lines.push(
      `## ${titleOf(media)} (${dateOf(media).slice(0, 4) || 'Unknown year'})`,
      '',
      `- Type: ${media.media_type === 'movie' ? 'Movie' : 'TV series'}`,
      `- Status: ${media.status || 'Unknown'}`,
      `- Runtime: ${runtime}`,
      `- Genres: ${media.genres.map((genre) => genre.name).join(', ') || 'Unknown'}`,
      `- Directors / leads: ${directorsOf(media).join(', ') || 'Unknown'}`,
      `- TMDB rating: ${media.vote_average.toFixed(1)}/10`,
      '',
      media.overview || 'No overview available.',
      '',
    );
    if (note) lines.push('### Research note', '', note, '');
  });
  lines.push('---', '', bundle.attribution, 'Data source: https://www.themoviedb.org', '');
  return lines.join('\n');
};
