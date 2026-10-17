# Changelog

## 1.4.1 - 2026-10-17

- Label the saved comparison selector so assistive technology identifies its purpose on both empty and populated desks.

## 1.4.0 - 2026-10-17

- Keep each saved library reference usable when its TMDB refresh fails; show cached details or a local reference with a refresh warning.
- Rename and delete custom lists, saved comparison sets and saved filter views. List deletion keeps titles and notes and moves otherwise unassigned titles to Watchlist.
- Preserve the default Watchlist and reject conflicting names before saving.

## 1.3.2 - 2026-10-17

- Normalize existing v2 lists and entries independently, retaining usable entries when a container is malformed without rewriting stored source bytes during reads.
- Migrate legacy watchlists only when v2 source is absent; preserve normal writable migration and keep the legacy view usable when migration writes fail because storage is full or blocked.
- Preserve retained legacy data and any v2 source that appears before the migration write.

## 1.3.1 - 2026-10-17

- Keep successful TMDB responses usable when optional cache writes fail; evict only this app's own oldest cache entries when quota or the 100-entry bound requires it.

- Keep usable library records, notes and comparison sets available when stored JSON has malformed records, without rewriting the stored source during recovery reads.
- Validate complete version 2 backups and their identities before preview or merge, rejecting invalid notes, entries and list references without changing local data.
- Remap colliding imported list and comparison IDs while preserving existing memberships; avoid new local ID collisions within one clock tick.
- Restore completed backup writes after handled storage failures and explain whether retry or inspection is needed.
- Record owner-reported real TMDB acceptance separately from automated fixture tests. Provider and token functions are unchanged.

All notable changes are documented here. This project follows Semantic Versioning.

## 1.3.0 - 2026-10-14

- Added case-insensitive, all-term local library search across titles, movie/TV IDs and tags. Search combines with existing list, status and tag filters without requiring a token.
- Added CSV export of the visible, sorted library with viewing status, priority, personal ratings, tags, list names and TMDB links. Private notes require an explicit opt-in; quoted cells and formula neutralization protect spreadsheet use.
- Patched existing Vitest, brace-expansion and source-map-js build/test dependency warnings with compatible versions.
- Updated the visible runtime version and current-release documentation.

## 1.1.0 - 2026-08-10

- Added named local lists with viewing states, priority, personal ratings, tags, filtering, and sorting.
- Added sortable comparisons, highlighted differences, and reusable saved comparison sets.
- Added versioned local backup export and import with an explicit merge and conflict preview.
- Added privacy-reviewed Markdown and JSON exports that can omit private notes completely.

## 1.0.0 - 2026-08-03

- Released a static movie and TV research-card application powered by a user-supplied TMDB token.
- Added movie/TV search, local ID-only watchlists, 24-hour response caching, and private notes.
- Added side-by-side comparison for up to four titles with credits, runtime, status, rating, genres,
  synopsis, trailer, and TMDB links.
- Added attributed Markdown and versioned JSON exports.
- Added responsive self-hosted UI, GitHub Pages deployment, CI, CodeQL, dependency monitoring, and
  release packaging.

## Version 1.2.0: reviewed improvements

Keep local workflows available without a token, add fictional offline samples and accessible naming, and save comparison fields and filter views.

Opening ScreenCard or its empty library no longer forces a token dialog. Search and uncached remote detail requests require an explicit connection; cached library details remain available with age/stale labels, while uncached references remain editable. Three fictional, clearly labeled demo cards work without TMDB requests or remote images. Native prompt dialogs for lists/comparison sets are replaced by labeled in-page dialogs. Quick, credits and complete comparison presets plus custom visible fields persist locally; up to 30 named library filter views can be saved and replaced. Column selection changes the view, not the complete research export payload. Private notes default to omitted from research and backup exports; an explicit checkbox includes them. Backup serialization uses defined library fields and excludes stored tokens/cache. Cache storage is capped at 100 entries, retaining stale details for offline review. Tests and desktop/mobile UI checks cover local behavior; no real TMDB-token/API acceptance is claimed. Existing workflow/package formatting failures are corrected.

Validation: `npm run validate` and `npm audit`.
