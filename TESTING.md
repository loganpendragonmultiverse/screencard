# Testing

Run the complete gate with Node.js 24 LTS (recommended), Node.js 22.13 or later in the 22 line, or Node.js 26 and later:

```shell
npm ci
npm run validate
npm audit
```

The gate checks formatting, ESLint, strict TypeScript, unit-test coverage, and the Vite production
build. Tests cover cache expiry, malformed storage, minimal watchlists, token persistence, notes,
TMDB result filtering, request caching, API errors, data formatting, named library metadata,
comparison sets, backup conflict previews and merges, and both export formats with and without
private notes.

## Manual release checks

Use a personal developer token that is never committed or recorded in test output.

1. Open the production build with no stored token and confirm local navigation works without a token dialog; request a remote search to open it.
2. Save a session-only token, refresh, and confirm search still works in that tab session.
3. Search a movie and a TV series; confirm people are absent.
4. Add four cards to Compare and confirm a fifth cannot be added.
5. Save a note, refresh, and confirm it remains local.
6. Add and remove watchlist entries.
7. Export Markdown and JSON and verify the note and TMDB attribution.
8. Clear the token and confirm searches do not silently use another credential.
9. Verify responsive layouts and keyboard focus at desktop and mobile widths.
10. Verify the deployed GitHub Pages URL and Forge catalog links.
11. Create a named list; change state, priority, personal rating, and tags; then filter and sort it.
12. Save and reload a comparison set, change its sort, and confirm differing values are highlighted.
13. Export a backup, create a local conflict, import it, review the preview, and confirm the merge.
14. Export Markdown and JSON with private notes disabled and confirm no note field or text remains.

## Version 1.2.0: reviewed improvements

Keep local workflows available without a token, add fictional offline samples and accessible naming, and save comparison fields and filter views.

Opening ScreenCard or its empty library no longer forces a token dialog. Search and uncached remote detail requests require an explicit connection; cached library details remain available with age/stale labels, while uncached references remain editable. Three fictional, clearly labeled demo cards work without TMDB requests or remote images. Native prompt dialogs for lists/comparison sets are replaced by labeled in-page dialogs. Quick, credits and complete comparison presets plus custom visible fields persist locally; up to 30 named library filter views can be saved and replaced. Column selection changes the view, not the complete research export payload. Private notes default to omitted from research and backup exports; an explicit checkbox includes them. Backup serialization uses defined library fields and excludes stored tokens/cache. Cache storage is capped at 100 entries, retaining stale details for offline review. Tests and desktop/mobile UI checks cover local behavior; no real TMDB-token/API acceptance is claimed. Existing workflow/package formatting failures are corrected.

Validation: `npm run validate` and `npm audit`.

## Version 1.3.0

The library unit tests cover all-term search, case/whitespace, tags and uncached typed IDs; visible-row selection/order, notes opt-in, CSV quoting and newlines, formula injection, empty exports and TMDB links. Before release, check the built app at desktop/mobile widths: add fictional demos to the library, filter by title and tag, combine state/list filters, export CSV, verify omitted and included notes, clear search and reload. Repeat both features against the deployed build. Real TMDB-token acceptance remains separate.

## Version 1.3.1: local data and backup recovery

Validate complete backup structure, enum values, note types, unique identities and list references before preview or any write. Remap imported ID collisions without moving existing entries between lists. Recovery readers ignore malformed persisted records while leaving the stored source untouched. Keep provider/token functions unchanged.

Backup writes are staged in memory, with prior values recorded. On a handled write failure, restore only completed writes whose values are still unchanged. Report incomplete recovery without overwriting intervening changes. This is not a crash-safe browser storage transaction. Regression tests exercise malformed stored/imported data, list/comparison identity collisions and each write-failure position followed by retry.

The owner's October 17, 2026 message reports both requested human tests complete, including the previously requested live TMDB token/connection test. Treat this as user-reported provider acceptance; automated API tests still use fixtures. No credential was requested, accessed or recorded.

### Optional cache failures

Cache writes must not discard a successful provider response. Only `screencard:cache:` entries may be evicted for quota or the 100-entry cache bound. Security/permission failures skip caching; notes, library, comparison and token keys are never eviction candidates. Fixture tests cover successful search/details with quota failures, oldest-cache eviction, non-quota failure preservation and the cache bound. Provider request and token functions remain unchanged.

## Version 1.3.2: legacy migration and malformed roots

Normalize v2 lists and entries independently and never rewrite present malformed/unsupported v2 source during recovery reads. Only migrate a valid legacy watchlist when the v2 key is absent, recheck absence before writing, preserve the legacy source, and treat failed migration writes as best effort so the usable legacy view remains available. Tests cover malformed lists with a valid v2 entry plus retained legacy data, absent-v2 writable migration, quota/blocked-write migration, and preservation of malformed/unsupported v2 bytes. Provider and token functions remain unchanged.

## Version 1.4.0: provider fallback and saved-item management

Exercise per-reference refresh failures with a retained synthetic token: stale cached and uncached library titles must remain visible/editable, warning labels must identify fallback, and successful siblings must still load. Search errors remain explicit. Test rename/delete/cancel for custom lists, comparison sets and saved views. List deletion retains entries, notes, other memberships and metadata; entries with no remaining membership move to Watchlist. The default Watchlist is protected. Saved views whose list was deleted reopen across all lists. Provider/token request functions remain unchanged; automated provider acceptance uses fixtures.

## Version 1.4.1: saved comparison label

The visible Saved comparison set label must be associated with its selector. Check the programmatic combobox name, save a set, reload to an empty desk, then load, rename and delete it in the built app across supported browser engines. Provider and token behavior is unchanged.

The optional repository browser regression uses an already available Playwright installation and its Chromium, Firefox and WebKit binaries:

```shell
npm run build
node scripts/browser-acceptance.mjs
```

No browser dependency is added to this project. If Playwright is installed elsewhere, set `PLAYWRIGHT_MODULE` to its ESM entry point. `SCREENCARD_DIST` selects an extracted release build instead of `dist`; `SCREENCARD_BROWSER_REPORT` writes the result JSON to an existing destination directory. The script serves the build on loopback, uses fictional offline cards and blocks remote requests.

## Vitest 5 developer-tool transition

Vitest and its V8 coverage provider must use matching versions. The paired upgrade retires end-of-life Node.js 20 support; Node.js 23 and 25 are also unsupported. The required `validate` job remains on Node.js 24. Separate compatibility checks run the same unchanged validation and audit gates on Node.js 22.13.0 and 26. Keep the existing coverage files and thresholds; do not bypass peer resolution or audit findings.

## Research-note save recovery (1.4.2)

Run `node scripts/note-save-acceptance.mjs` against the built site with the existing optional Playwright runtime (`PLAYWRIGHT_MODULE`, `SCREENCARD_DIST` and `SCREENCARD_NOTE_REPORT` may select it and the report path). No dependency is downloaded by that script. In Chromium, Firefox and WebKit, fill actual isolated browser localStorage to quota, edit a short note, blur and navigate away/back. Verify a visible unsaved failure, the exact draft survives and the prior persisted note is unchanged. Free only synthetic quota filler, retry, reload and verify the edit is now persisted. Cover independent notes, deletion drafts and blocked storage in unit tests. Native real-provider acceptance remains user-reported; offline fixtures do not independently verify TMDB.

## Search pagination (1.5.0)

Movie/TV search now includes Previous and Next page controls and the successful query's page number. A new search starts at page 1. The interface retains one page at a time and caps navigation at 500 pages. TMDB multi-search totals include people, so a page can contain no movie/TV titles while later pages remain available. Each query/page has a separate key in the existing bounded cache. Missing pagination fields in older cached responses safely expose only page 1.

Failed requests retain the previous cards and page label for retry. Superseded requests cannot replace a newer search or the fictional offline demo. Search input survives rerenders. No accounts, provider credentials, permissions or export fields are added.

Before release, use fixture-only provider responses in Chromium, Firefox and WebKit at desktop/mobile widths: previous/next and final-page bounds; new-query reset; people-only intermediate page; a failed next page and retry; stale response after a newer query or demo; cached back-navigation; watchlist/compare controls on later pages. Keep all remote requests intercepted and use only synthetic tokens. Verify the exact release ZIP and deployed Pages assets. These fixtures do not establish new live-provider acceptance.
