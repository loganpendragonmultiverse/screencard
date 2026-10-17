# Development

## Product boundary

ScreenCard is a static, local-first research and comparison tool. The core product must remain
usable without a ScreenCard account, backend, analytics service, or shared API credential.

Version 1 owns these capabilities:

- user-supplied TMDB Bearer-token authentication;
- movie and TV search;
- local watchlist references and notes;
- named local lists, viewing metadata, and versioned backup/merge;
- side-by-side research cards;
- Markdown and JSON export;
- saved comparison sets, sorting, and difference highlighting;
- bounded local response caching;
- complete TMDB attribution.

It does not own social recommendations, streaming-provider aggregation, TMDB account mutation,
commercial API licensing, or a hosted token proxy.

## Architecture

- `src/tmdb.ts` is the only TMDB request boundary and handles error translation and caching.
- `src/storage.ts` owns local persistence and keeps watchlist records intentionally minimal.
- `src/storage.ts` migrates version 1 watchlists into the version 2 local library and owns
  deterministic backup conflict previews and merges.
- `src/export.ts` creates deterministic portable research packages with attribution.
- `src/app.ts` owns DOM rendering and user interactions.
- `public/assets/tmdb-logo.svg` is an unmodified approved TMDB attribution asset.

All untrusted text from TMDB and local research notes is escaped before HTML rendering. API tokens
must never enter logs, exports, repository files, URLs, analytics, or error messages.

## Release contract

Every release must update the version, changelog, documentation, tests, GitHub release, live Pages
build, Forge open-source catalog, and portfolio index together. Release only from protected `main`
after CI and CodeQL pass.

Any expansion that uses streaming-provider data must implement the applicable JustWatch attribution
and regional semantics before merging. Any commercial deployment must independently satisfy TMDB's
commercial licensing requirements.

Version 1.1 retains the static, account-free boundary. Backup import must preview counts and named
conflicts before writing. TMDB tokens and cached API responses must never enter backup or research
exports. Share exports must let the user omit private notes without leaving empty note fields.

## Version 1.2.0: reviewed improvements

Keep local workflows available without a token, add fictional offline samples and accessible naming, and save comparison fields and filter views.

Opening ScreenCard or its empty library no longer forces a token dialog. Search and uncached remote detail requests require an explicit connection; cached library details remain available with age/stale labels, while uncached references remain editable. Three fictional, clearly labeled demo cards work without TMDB requests or remote images. Native prompt dialogs for lists/comparison sets are replaced by labeled in-page dialogs. Quick, credits and complete comparison presets plus custom visible fields persist locally; up to 30 named library filter views can be saved and replaced. Column selection changes the view, not the complete research export payload. Private notes default to omitted from research and backup exports; an explicit checkbox includes them. Backup serialization uses defined library fields and excludes stored tokens/cache. Cache storage is capped at 100 entries, retaining stale details for offline review. Tests and desktop/mobile UI checks cover local behavior; no real TMDB-token/API acceptance is claimed. Existing workflow/package formatting failures are corrected.

Validation: `npm run validate` and `npm audit`.

## Version 1.3.0

`src/library.ts` owns pure local query matching and CSV serialization. Search operates only on titles, typed IDs and tags and combines with existing filters. CSV receives the already filtered/sorted cards, uses explicit metadata fields, never reads tokens or cached payloads, and omits private notes by default. Quote all cells, escape embedded quotes, and neutralize spreadsheet formula prefixes including leading whitespace/control characters. No storage migration or network endpoint is added.

## Version 1.3.1: local data and backup recovery

Validate complete backup structure, enum values, note types, unique identities and list references before preview or any write. Remap imported ID collisions without moving existing entries between lists. Recovery readers ignore malformed persisted records while leaving the stored source untouched. Keep provider/token functions unchanged.

Backup writes are staged in memory, with prior values recorded. On a handled write failure, restore only completed writes whose values are still unchanged. Report incomplete recovery without overwriting intervening changes. This is not a crash-safe browser storage transaction. Regression tests exercise malformed stored/imported data, list/comparison identity collisions and each write-failure position followed by retry.

The owner's October 17, 2026 message reports both requested human tests complete, including the previously requested live TMDB token/connection test. Treat this as user-reported provider acceptance; automated API tests still use fixtures. No credential was requested, accessed or recorded.

### Optional cache failures

Cache writes must not discard a successful provider response. Only `screencard:cache:` entries may be evicted for quota or the 100-entry cache bound. Security/permission failures skip caching; notes, library, comparison and token keys are never eviction candidates. Fixture tests cover successful search/details with quota failures, oldest-cache eviction, non-quota failure preservation and the cache bound. Provider request and token functions remain unchanged.

## Version 1.3.2: legacy migration and malformed roots

Normalize v2 lists and entries independently and never rewrite present malformed/unsupported v2 source during recovery reads. Only migrate a valid legacy watchlist when the v2 key is absent, recheck absence before writing, preserve the legacy source, and treat failed migration writes as best effort so the usable legacy view remains available. Tests cover malformed lists with a valid v2 entry plus retained legacy data, absent-v2 writable migration, quota/blocked-write migration, and preservation of malformed/unsupported v2 bytes. Provider and token functions remain unchanged.
