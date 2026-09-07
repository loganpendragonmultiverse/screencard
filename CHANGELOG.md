# Changelog

All notable changes are documented here. This project follows Semantic Versioning.

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
