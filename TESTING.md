# Testing

Run the complete gate with Node.js 20.19 or later:

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
