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

1. Open the production build with no stored token and confirm the token dialog appears.
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
