import './styles.css';
import { buildExport, exportJson, exportMarkdown } from './export';
import {
  buildBackup,
  clearToken,
  createList,
  getComparisonSets,
  getLibrary,
  getNotes,
  getToken,
  getWatchlist,
  mergeBackup,
  previewBackupMerge,
  saveComparisonSet,
  setNote,
  setToken,
  toggleWatchlist,
  updateLibraryEntry,
} from './storage';
import {
  directorsOf,
  getMediaDetails,
  imageUrl,
  searchMedia,
  titleOf,
  trailerOf,
  yearOf,
} from './tmdb';
import type {
  LibraryEntry,
  MediaDetails,
  MediaRef,
  MediaType,
  ScreenCardBackup,
  SearchResult,
} from './types';

type View = 'search' | 'compare' | 'watchlist' | 'about';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('ScreenCard could not start.');

let view: View = 'search';
let token = getToken(sessionStorage, localStorage);
let results: SearchResult[] = [];
let compare: MediaDetails[] = [];
let watchlistDetails: MediaDetails[] = [];
let busy = false;
let status = '';
let activeList = 'all';
let activeStatus = 'all';
let activeTag = '';
let librarySort = 'priority';
let compareSort = 'added';

const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const mediaKey = (media: Pick<SearchResult, 'id' | 'media_type'>): string =>
  `${media.media_type}:${media.id}`;

const isWatched = (media: Pick<SearchResult, 'id' | 'media_type'>): boolean =>
  getWatchlist(localStorage).some(
    (item) => item.id === media.id && item.mediaType === media.media_type,
  );

const download = (filename: string, value: string, type: string): void => {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const shell = (): string => `
  <header class="app-header">
    <button class="brand" data-view="search" aria-label="Open search">
      <span class="brand-mark">SC</span><span><strong>ScreenCard</strong><small>Research before you watch</small></span>
    </button>
    <nav aria-label="Primary navigation">
      <button data-view="search" class="${view === 'search' ? 'active' : ''}">Discover</button>
      <button data-view="compare" class="${view === 'compare' ? 'active' : ''}">Compare <em>${compare.length || ''}</em></button>
      <button data-view="watchlist" class="${view === 'watchlist' ? 'active' : ''}">Library <em>${getWatchlist(localStorage).length || ''}</em></button>
      <button data-view="about" class="${view === 'about' ? 'active' : ''}">About</button>
    </nav>
    <button class="settings-button" data-action="settings" aria-label="TMDB token settings">Token</button>
  </header>
  <main>${content()}</main>
  <footer class="site-footer">
    <span>Local-first. No accounts. No tracking.</span>
    <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer"><img src="./assets/tmdb-logo.svg" alt="TMDB" /></a>
  </footer>
  <dialog id="token-dialog">${tokenForm()}</dialog>
  <div class="toast ${status ? 'show' : ''}" role="status">${escapeHtml(status)}</div>
`;

const content = (): string => {
  if (view === 'compare') return compareView();
  if (view === 'watchlist') return watchlistView();
  if (view === 'about') return aboutView();
  return searchView();
};

const searchView = (): string => `
  <section class="hero">
    <div>
      <p class="eyebrow">A portable research desk for the screen</p>
      <h1>Choose with context,<br /><span>not another scroll.</span></h1>
      <p>Search movies and series, keep a local shortlist, compare the details that matter, and export your research without creating an account.</p>
    </div>
    <form id="search-form" class="search-box">
      <label for="search-input">Search movies and TV</label>
      <div><input id="search-input" name="query" placeholder="Try Arrival, Severance, or The Bear" autocomplete="off" required /><button ${busy ? 'disabled' : ''}>${busy ? 'Searching…' : 'Search'}</button></div>
      <small>Results and images come directly from TMDB using your own token.</small>
    </form>
  </section>
  <section class="results-section">
    <div class="section-heading"><div><p>Search result cards</p><h2>${results.length ? `${results.length} titles` : 'Start with a title'}</h2></div><span>Select up to four cards to compare.</span></div>
    ${results.length ? `<div class="result-grid">${results.map(resultCard).join('')}</div>` : emptyState('Your research cards will appear here.', 'Each result includes a synopsis, year, type, and TMDB community rating.')}
  </section>`;

const resultCard = (media: SearchResult): string => {
  const poster = imageUrl(media.poster_path, 'w500');
  const selected = compare.some((item) => mediaKey(item) === mediaKey(media));
  return `<article class="result-card">
    <div class="poster-wrap">${poster ? `<img src="${poster}" alt="Poster for ${escapeHtml(titleOf(media))}" loading="lazy" />` : '<div class="poster-fallback">No poster</div>'}<span>${media.media_type === 'movie' ? 'Movie' : 'Series'}</span></div>
    <div class="result-copy"><div class="rating">★ ${media.vote_average.toFixed(1)}</div><h3>${escapeHtml(titleOf(media))}</h3><small>${escapeHtml(yearOf(media))}</small><p>${escapeHtml(media.overview || 'No synopsis is available.')}</p></div>
    <footer><button data-action="watch" data-type="${media.media_type}" data-id="${media.id}" class="quiet">${isWatched(media) ? '✓ Watchlist' : '+ Watchlist'}</button><button data-action="compare" data-type="${media.media_type}" data-id="${media.id}" ${selected || compare.length >= 4 ? 'disabled' : ''}>${selected ? 'Selected' : 'Compare'}</button></footer>
  </article>`;
};

const comparisonCard = (media: MediaDetails): string => {
  const notes = getNotes(localStorage);
  const trailer = trailerOf(media);
  const runtime =
    media.media_type === 'movie'
      ? media.runtime
        ? `${media.runtime} min`
        : '—'
      : `${media.number_of_seasons ?? '—'} seasons · ${media.number_of_episodes ?? '—'} episodes`;
  return `<article class="comparison-card">
    <button class="remove-card" data-action="remove-compare" data-key="${mediaKey(media)}" aria-label="Remove ${escapeHtml(titleOf(media))}">×</button>
    <div class="comparison-poster">${media.poster_path ? `<img src="${imageUrl(media.poster_path, 'w500')}" alt="Poster for ${escapeHtml(titleOf(media))}" />` : ''}</div>
    <p class="media-kind">${media.media_type === 'movie' ? 'Movie' : 'TV series'} · ${escapeHtml(yearOf(media))}</p>
    <h2>${escapeHtml(titleOf(media))}</h2><p class="tagline">${escapeHtml(media.tagline)}</p>
    <dl><div class="${differenceClass('rating', media.vote_average.toFixed(1))}"><dt>Rating</dt><dd>${media.vote_average.toFixed(1)} / 10</dd></div><div class="${differenceClass('runtime', runtime)}"><dt>Runtime</dt><dd>${escapeHtml(runtime)}</dd></div><div class="${differenceClass('status', media.status)}"><dt>Status</dt><dd>${escapeHtml(media.status)}</dd></div><div class="${differenceClass('genres', media.genres.map((item) => item.name).join(', '))}"><dt>Genres</dt><dd>${escapeHtml(media.genres.map((item) => item.name).join(', ') || '—')}</dd></div><div><dt>Director / leads</dt><dd>${escapeHtml(directorsOf(media).join(', ') || '—')}</dd></div><div><dt>Top cast</dt><dd>${escapeHtml(
      media.credits.cast
        .slice(0, 5)
        .map((item) => item.name)
        .join(', ') || '—',
    )}</dd></div></dl>
    <p class="overview">${escapeHtml(media.overview || 'No synopsis is available.')}</p>
    <label class="note-field">Research note<textarea data-note="${mediaKey(media)}" placeholder="Why this title, who is it for, or what do you want to remember?">${escapeHtml(notes[mediaKey(media)] ?? '')}</textarea></label>
    <div class="card-links">${trailer ? `<a href="${trailer}" target="_blank" rel="noreferrer">Watch trailer ↗</a>` : ''}<a href="https://www.themoviedb.org/${media.media_type}/${media.id}" target="_blank" rel="noreferrer">View on TMDB ↗</a></div>
  </article>`;
};

const differenceClass = (field: string, value: string): string => {
  const values = compare.map((item) => {
    if (field === 'rating') return item.vote_average.toFixed(1);
    if (field === 'runtime')
      return item.media_type === 'movie'
        ? item.runtime
          ? `${item.runtime} min`
          : '—'
        : `${item.number_of_seasons ?? '—'} seasons · ${item.number_of_episodes ?? '—'} episodes`;
    if (field === 'status') return item.status;
    return item.genres.map((genre) => genre.name).join(', ');
  });
  return new Set(values).size > 1 && values.includes(value) ? 'different' : '';
};

const orderedComparison = (): MediaDetails[] =>
  [...compare].sort((a, b) => {
    if (compareSort === 'rating') return b.vote_average - a.vote_average;
    if (compareSort === 'year') return yearOf(b).localeCompare(yearOf(a));
    if (compareSort === 'title') return titleOf(a).localeCompare(titleOf(b));
    return 0;
  });

const compareView = (): string => `
  <section class="page-intro"><p>Side-by-side research</p><h1>Comparison desk</h1><span>Keep the differences visible. Notes and selections remain on this device.</span></section>
  ${
    compare.length
      ? `<div class="export-bar comparison-tools"><label>Sort<select id="compare-sort"><option value="added">Added order</option><option value="rating" ${compareSort === 'rating' ? 'selected' : ''}>Rating</option><option value="year" ${compareSort === 'year' ? 'selected' : ''}>Year</option><option value="title" ${compareSort === 'title' ? 'selected' : ''}>Title</option></select></label><label class="include-notes"><input id="include-notes" type="checkbox" checked /> Include private notes</label><div><button data-action="save-comparison">Save set</button><select id="saved-comparison"><option value="">Load saved set…</option>${getComparisonSets(
          localStorage,
        )
          .map((set) => `<option value="${escapeHtml(set.id)}">${escapeHtml(set.name)}</option>`)
          .join(
            '',
          )}</select><button data-action="export-md">Export Markdown</button><button data-action="export-json">Export JSON</button></div></div><section class="comparison-grid" style="--columns:${compare.length}">${orderedComparison().map(comparisonCard).join('')}</section>`
      : emptyState(
          'No cards selected yet.',
          'Return to Discover and select up to four movies or series.',
          '<button data-view="search">Discover titles</button>',
        )
  }`;

const watchlistView = (): string => `
  <section class="page-intro"><p>Saved on this device</p><h1>Local library</h1><span>Organize titles in named lists, track viewing state, and keep personal ratings, priority, and tags without an account.</span></section>
  ${libraryToolbar()}
  ${busy ? emptyState('Loading your cards…', 'Refreshing details from TMDB.') : filteredLibrary().length ? `<div class="result-grid library-grid">${filteredLibrary().map(libraryCard).join('')}</div>` : emptyState('Nothing matches this view.', 'Save a title or change the local filters.', '<button data-view="search">Discover titles</button>')}`;

const libraryToolbar = (): string => {
  const library = getLibrary(localStorage);
  const tags = [...new Set(library.entries.flatMap((entry) => entry.tags))].sort();
  return `<section class="library-toolbar">
    <label>List<select id="list-filter"><option value="all">All lists</option>${library.lists.map((list) => `<option value="${escapeHtml(list.id)}" ${activeList === list.id ? 'selected' : ''}>${escapeHtml(list.name)}</option>`).join('')}</select></label>
    <label>Status<select id="status-filter"><option value="all">All states</option>${['want-to-watch', 'watching', 'watched', 'paused', 'skipped'].map((value) => `<option value="${value}" ${activeStatus === value ? 'selected' : ''}>${value.replaceAll('-', ' ')}</option>`).join('')}</select></label>
    <label>Tag<select id="tag-filter"><option value="">All tags</option>${tags.map((tag) => `<option ${activeTag === tag ? 'selected' : ''}>${escapeHtml(tag)}</option>`).join('')}</select></label>
    <label>Sort<select id="library-sort"><option value="priority">Priority</option><option value="rating" ${librarySort === 'rating' ? 'selected' : ''}>Personal rating</option><option value="added" ${librarySort === 'added' ? 'selected' : ''}>Recently added</option><option value="title" ${librarySort === 'title' ? 'selected' : ''}>Title</option></select></label>
    <div class="toolbar-actions"><button data-action="new-list">New list</button><button data-action="backup">Export backup</button><label class="import-button">Import / merge<input id="backup-file" type="file" accept="application/json,.json" hidden /></label></div>
  </section>`;
};

const filteredLibrary = (): MediaDetails[] => {
  const entries = getLibrary(localStorage).entries;
  const byKey = new Map(entries.map((entry) => [`${entry.mediaType}:${entry.id}`, entry]));
  return watchlistDetails
    .filter((media) => {
      const entry = byKey.get(mediaKey(media));
      return Boolean(
        entry &&
        (activeList === 'all' || entry.listIds.includes(activeList)) &&
        (activeStatus === 'all' || entry.status === activeStatus) &&
        (!activeTag || entry.tags.includes(activeTag)),
      );
    })
    .sort((a, b) => {
      const left = byKey.get(mediaKey(a))!;
      const right = byKey.get(mediaKey(b))!;
      if (librarySort === 'rating')
        return (right.personalRating ?? -1) - (left.personalRating ?? -1);
      if (librarySort === 'added') return right.addedAt - left.addedAt;
      if (librarySort === 'title') return titleOf(a).localeCompare(titleOf(b));
      return (
        { high: 0, normal: 1, low: 2 }[left.priority] -
          { high: 0, normal: 1, low: 2 }[right.priority] || right.addedAt - left.addedAt
      );
    });
};

const libraryCard = (media: MediaDetails): string => {
  const library = getLibrary(localStorage);
  const entry = library.entries.find((item) => `${item.mediaType}:${item.id}` === mediaKey(media))!;
  const poster = imageUrl(media.poster_path, 'w500');
  return `<article class="result-card library-card"><div class="poster-wrap">${poster ? `<img src="${poster}" alt="Poster for ${escapeHtml(titleOf(media))}" loading="lazy" />` : '<div class="poster-fallback">No poster</div>'}</div><div class="result-copy"><h3>${escapeHtml(titleOf(media))}</h3><small>${escapeHtml(yearOf(media))}</small>
    <label>Status<select data-entry="${mediaKey(media)}" data-field="status">${['want-to-watch', 'watching', 'watched', 'paused', 'skipped'].map((value) => `<option value="${value}" ${entry.status === value ? 'selected' : ''}>${value.replaceAll('-', ' ')}</option>`).join('')}</select></label>
    <label>Priority<select data-entry="${mediaKey(media)}" data-field="priority">${['high', 'normal', 'low'].map((value) => `<option ${entry.priority === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label>
    <label>Personal rating<input data-entry="${mediaKey(media)}" data-field="rating" type="number" min="0" max="10" step="0.5" value="${entry.personalRating ?? ''}" placeholder="0–10" /></label>
    <label>Tags<input data-entry="${mediaKey(media)}" data-field="tags" value="${escapeHtml(entry.tags.join(', '))}" placeholder="slow burn, family" /></label>
    <label>List<select data-entry="${mediaKey(media)}" data-field="list">${library.lists.map((list) => `<option value="${escapeHtml(list.id)}" ${entry.listIds.includes(list.id) ? 'selected' : ''}>${escapeHtml(list.name)}</option>`).join('')}</select></label></div>
    <footer><button data-action="watch" data-type="${media.media_type}" data-id="${media.id}" class="quiet">Remove</button><button data-action="compare" data-type="${media.media_type}" data-id="${media.id}">Compare</button></footer></article>`;
};

const aboutView = (): string => `
  <section class="about-layout"><div><p class="eyebrow">About ScreenCard</p><h1>Research cards you control.</h1><p>ScreenCard is a static, self-hostable app. It sends searches directly from your browser to TMDB with the API Read Access Token you provide. There is no ScreenCard server, account, analytics, advertising, or tracking.</p><h2>What stays local</h2><p>Your watchlist IDs, comparison notes, and optional remembered token use this browser's storage. Clear site data to remove them. Choose session-only token storage on shared devices.</p><h2>Exports</h2><p>Markdown and JSON exports include the cards currently on your comparison desk, your local notes, and required data attribution.</p></div><aside class="credits-card"><img src="./assets/tmdb-logo.svg" alt="TMDB" /><h2>Data credits</h2><p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p><a href="https://www.themoviedb.org" target="_blank" rel="noreferrer">Visit The Movie Database ↗</a><hr /><small>The included TMDB logo is an approved attribution asset and remains a trademark of its owner.</small></aside></section>`;

const emptyState = (title: string, copy: string, action = ''): string =>
  `<div class="empty-state"><span>◇</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(copy)}</p>${action}</div>`;

const tokenForm = (): string => `
  <form id="token-form" method="dialog"><div class="dialog-head"><div><p>Connection settings</p><h2>Your TMDB token</h2></div><button type="button" data-action="close-dialog" aria-label="Close">×</button></div>
    <p>Paste the API Read Access Token from your TMDB account. ScreenCard uses it only for direct browser-to-TMDB requests.</p>
    <label>API Read Access Token<input id="token-input" type="password" value="${escapeHtml(token)}" autocomplete="off" placeholder="eyJhbGciOiJIUzI1NiJ9…" required /></label>
    <label class="remember"><input id="remember-token" type="checkbox" ${localStorage.getItem('screencard:tmdb-token') ? 'checked' : ''} /> Remember on this device</label>
    <div class="token-warning">Treat this token like a password. Use session-only storage on a shared computer. ScreenCard never sends it anywhere except <strong>api.themoviedb.org</strong>.</div>
    <footer><button type="button" class="danger" data-action="clear-token">Clear token</button><button type="button" data-action="close-dialog">Cancel</button><button class="primary">Save token</button></footer>
  </form>`;

const render = (): void => {
  app.innerHTML = shell();
  bindEvents();
  if (!token) document.querySelector<HTMLDialogElement>('#token-dialog')?.showModal();
};

const setStatus = (message: string): void => {
  status = message;
  render();
  window.setTimeout(() => {
    status = '';
    document.querySelector('.toast')?.classList.remove('show');
  }, 3200);
};

const refFrom = (element: HTMLElement): MediaRef => ({
  id: Number(element.dataset.id),
  mediaType: element.dataset.type as MediaType,
  addedAt: Date.now(),
});

const loadDetails = async (ref: MediaRef): Promise<MediaDetails> => {
  if (!token) throw new Error('Add your TMDB API Read Access Token first.');
  return getMediaDetails(ref.mediaType, ref.id, token, localStorage);
};

const runSearch = async (query: string): Promise<void> => {
  if (!token) {
    document.querySelector<HTMLDialogElement>('#token-dialog')?.showModal();
    return;
  }
  busy = true;
  render();
  try {
    results = await searchMedia(query, token, localStorage);
    status = results.length ? '' : 'No movie or TV results matched that search.';
  } catch (error) {
    status = error instanceof Error ? error.message : 'Search failed.';
  } finally {
    busy = false;
    render();
  }
};

const loadWatchlist = async (): Promise<void> => {
  busy = true;
  render();
  try {
    watchlistDetails = await Promise.all(getWatchlist(localStorage).map(loadDetails));
  } catch (error) {
    status = error instanceof Error ? error.message : 'The watchlist could not load.';
  } finally {
    busy = false;
    render();
  }
};

const addComparison = async (ref: MediaRef): Promise<void> => {
  if (compare.length >= 4) return setStatus('Remove a card before adding another comparison.');
  try {
    const media = await loadDetails(ref);
    if (!compare.some((item) => mediaKey(item) === mediaKey(media))) compare = [...compare, media];
    setStatus(`${titleOf(media)} added to the comparison desk.`);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'That card could not load.');
  }
};

const exportCards = (format: 'md' | 'json'): void => {
  const cards = compare.length ? compare : watchlistDetails;
  if (!cards.length) return setStatus('Add comparison cards before exporting.');
  const includeNotes = document.querySelector<HTMLInputElement>('#include-notes')?.checked ?? true;
  const bundle = buildExport(cards, getNotes(localStorage), new Date().toISOString(), includeNotes);
  download(
    `screencard-research-${new Date().toISOString().slice(0, 10)}.${format}`,
    format === 'md' ? exportMarkdown(bundle) : exportJson(bundle),
    format === 'md' ? 'text/markdown;charset=utf-8' : 'application/json;charset=utf-8',
  );
};

const loadComparisonSet = async (id: string): Promise<void> => {
  const saved = getComparisonSets(localStorage).find((set) => set.id === id);
  if (!saved) return;
  try {
    compare = await Promise.all(
      saved.media.slice(0, 4).map((ref) => loadDetails({ ...ref, addedAt: saved.savedAt })),
    );
    setStatus(`${saved.name} loaded.`);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'The comparison set could not load.');
  }
};

const importBackup = async (file: File): Promise<void> => {
  try {
    const backup = JSON.parse(await file.text()) as ScreenCardBackup;
    const preview = previewBackupMerge(localStorage, backup);
    const conflicts = preview.noteConflicts.length + preview.comparisonConflicts.length;
    const conflictDetails = [
      ...preview.noteConflicts.map((key) => `note ${key}`),
      ...preview.comparisonConflicts.map((name) => `comparison “${name}”`),
    ].join(', ');
    const approved = window.confirm(
      `Merge ${preview.newEntries} new and ${preview.updatedEntries} existing titles, ${preview.newLists} new lists, and ${conflicts} conflicts?${conflictDetails ? ` Conflicts: ${conflictDetails}.` : ''} Incoming values win for listed conflicts.`,
    );
    if (!approved) return setStatus('Backup merge canceled.');
    mergeBackup(localStorage, backup);
    await loadWatchlist();
    setStatus('Backup merged. Existing local data was preserved unless a conflict was shown.');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'The backup could not be imported.');
  }
};

const changeView = (next: View): void => {
  view = next;
  render();
  if (next === 'watchlist') void loadWatchlist();
};

const bindEvents = (): void => {
  document
    .querySelectorAll<HTMLElement>('[data-view]')
    .forEach((button) =>
      button.addEventListener('click', () => changeView(button.dataset.view as View)),
    );
  document.querySelector('#search-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget as HTMLFormElement);
    void runSearch(String(form.get('query') ?? '').trim());
  });
  document.querySelectorAll<HTMLElement>('[data-action="watch"]').forEach((button) =>
    button.addEventListener('click', () => {
      const ref = refFrom(button);
      toggleWatchlist(localStorage, ref.id, ref.mediaType);
      setStatus(
        isWatched({ id: ref.id, media_type: ref.mediaType })
          ? 'Saved to your local watchlist.'
          : 'Removed from your watchlist.',
      );
    }),
  );
  document
    .querySelectorAll<HTMLElement>('[data-action="compare"]')
    .forEach((button) =>
      button.addEventListener('click', () => void addComparison(refFrom(button))),
    );
  document.querySelectorAll<HTMLElement>('[data-action="remove-compare"]').forEach((button) =>
    button.addEventListener('click', () => {
      compare = compare.filter((item) => mediaKey(item) !== button.dataset.key);
      render();
    }),
  );
  document.querySelectorAll<HTMLTextAreaElement>('[data-note]').forEach((textarea) =>
    textarea.addEventListener('change', () => {
      setNote(localStorage, textarea.dataset.note ?? '', textarea.value);
      setStatus('Research note saved locally.');
    }),
  );
  document.querySelector('#list-filter')?.addEventListener('change', (event) => {
    activeList = (event.target as HTMLSelectElement).value;
    render();
  });
  document.querySelector('#status-filter')?.addEventListener('change', (event) => {
    activeStatus = (event.target as HTMLSelectElement).value;
    render();
  });
  document.querySelector('#tag-filter')?.addEventListener('change', (event) => {
    activeTag = (event.target as HTMLSelectElement).value;
    render();
  });
  document.querySelector('#library-sort')?.addEventListener('change', (event) => {
    librarySort = (event.target as HTMLSelectElement).value;
    render();
  });
  document.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-entry]').forEach((input) =>
    input.addEventListener('change', () => {
      const key = input.dataset.entry ?? '';
      const field = input.dataset.field;
      if (field === 'status')
        updateLibraryEntry(localStorage, key, { status: input.value as LibraryEntry['status'] });
      if (field === 'priority')
        updateLibraryEntry(localStorage, key, {
          priority: input.value as LibraryEntry['priority'],
        });
      if (field === 'rating') {
        const rating = input.value ? Number(input.value) : null;
        if (rating !== null && (rating < 0 || rating > 10))
          return setStatus('Personal ratings must be from 0 to 10.');
        updateLibraryEntry(localStorage, key, { personalRating: rating });
      }
      if (field === 'tags')
        updateLibraryEntry(localStorage, key, {
          tags: input.value
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
        });
      if (field === 'list') updateLibraryEntry(localStorage, key, { listIds: [input.value] });
      setStatus('Library details saved locally.');
    }),
  );
  document.querySelector('[data-action="new-list"]')?.addEventListener('click', () => {
    const name = window.prompt('Name this local list:') ?? '';
    try {
      if (name) createList(localStorage, name);
      render();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'The list could not be created.');
    }
  });
  document
    .querySelector('[data-action="backup"]')
    ?.addEventListener('click', () =>
      download(
        `screencard-backup-${new Date().toISOString().slice(0, 10)}.json`,
        JSON.stringify(buildBackup(localStorage), null, 2),
        'application/json;charset=utf-8',
      ),
    );
  document.querySelector<HTMLInputElement>('#backup-file')?.addEventListener('change', (event) => {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (file) void importBackup(file);
  });
  document.querySelector('#compare-sort')?.addEventListener('change', (event) => {
    compareSort = (event.target as HTMLSelectElement).value;
    render();
  });
  document.querySelector('[data-action="save-comparison"]')?.addEventListener('click', () => {
    const name = window.prompt('Name this comparison set:') ?? '';
    try {
      if (name)
        saveComparisonSet(
          localStorage,
          name,
          compare.map((media) => ({ id: media.id, mediaType: media.media_type })),
        );
      render();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'The comparison could not be saved.');
    }
  });
  document
    .querySelector('#saved-comparison')
    ?.addEventListener(
      'change',
      (event) => void loadComparisonSet((event.target as HTMLSelectElement).value),
    );
  document
    .querySelector('[data-action="export-md"]')
    ?.addEventListener('click', () => exportCards('md'));
  document
    .querySelector('[data-action="export-json"]')
    ?.addEventListener('click', () => exportCards('json'));
  document
    .querySelector('[data-action="settings"]')
    ?.addEventListener('click', () =>
      document.querySelector<HTMLDialogElement>('#token-dialog')?.showModal(),
    );
  document
    .querySelectorAll('[data-action="close-dialog"]')
    .forEach((button) =>
      button.addEventListener('click', () =>
        document.querySelector<HTMLDialogElement>('#token-dialog')?.close(),
      ),
    );
  document.querySelector('[data-action="clear-token"]')?.addEventListener('click', () => {
    clearToken(sessionStorage, localStorage);
    token = '';
    render();
  });
  document.querySelector('#token-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = document.querySelector<HTMLInputElement>('#token-input')?.value.trim() ?? '';
    const remember = Boolean(document.querySelector<HTMLInputElement>('#remember-token')?.checked);
    if (!value) return;
    token = value;
    setToken(sessionStorage, localStorage, token, remember);
    document.querySelector<HTMLDialogElement>('#token-dialog')?.close();
    setStatus('TMDB token saved. Run a search to verify it.');
  });
};

render();
