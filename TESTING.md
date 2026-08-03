# Testing

Run the complete gate with Node.js 20.19 or later:

```shell
npm ci
npm run validate
npm audit
```

The gate checks formatting, ESLint, strict TypeScript, unit-test coverage, and the Vite production
build. Tests cover cache expiry, malformed storage, minimal watchlists, token persistence, notes,
TMDB result filtering, request caching, API errors, data formatting, and both export formats.

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
