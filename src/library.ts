import { titleOf, yearOf } from './tmdb';
import type { LibraryEntry, LibraryState, MediaDetails } from './types';

/** Search only local titles, IDs and tags; private notes are never searched. */
export function matchesLibraryQuery(
  media: MediaDetails,
  entry: LibraryEntry,
  query: string,
): boolean {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const text = [titleOf(media), `${entry.mediaType}:${entry.id}`, ...entry.tags]
    .join(' ')
    .toLocaleLowerCase();
  return terms.every((term) => text.includes(term));
}

function csvCell(value: unknown): string {
  let text = String(value ?? '');
  // Quoting alone does not stop spreadsheet formula execution.
  // eslint-disable-next-line no-control-regex -- spreadsheet safety requires leading controls.
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

/** Export exactly the supplied visible cards, with an explicit notes opt-in. */
export function exportLibraryCsv(
  cards: MediaDetails[],
  library: LibraryState,
  notes: Record<string, string> = {},
  includeNotes = false,
): string {
  const entries = new Map(
    library.entries.map((entry) => [`${entry.mediaType}:${entry.id}`, entry]),
  );
  const lists = new Map(library.lists.map((list) => [list.id, list.name]));
  const header = [
    'Title',
    'Type',
    'Year',
    'Status',
    'Priority',
    'Personal rating',
    'Tags',
    'Lists',
    'TMDB URL',
  ];
  if (includeNotes) header.push('Private note');
  const rows = cards.flatMap((media) => {
    const key = `${media.media_type}:${media.id}`;
    const entry = entries.get(key);
    if (!entry) return [];
    const row = [
      titleOf(media),
      media.media_type,
      yearOf(media),
      entry.status,
      entry.priority,
      entry.personalRating ?? '',
      entry.tags.join('; '),
      entry.listIds.map((id) => lists.get(id) ?? id).join('; '),
      media.id > 0 ? `https://www.themoviedb.org/${media.media_type}/${media.id}` : '',
    ];
    if (includeNotes) row.push(notes[key] ?? '');
    return [row];
  });
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
