# Contributing

Focused bug fixes, accessibility improvements, documentation corrections, tests, and changes that
preserve ScreenCard's local-first product boundary are welcome.

1. Open an issue describing the verified problem or bounded change.
2. Create a branch from `main`.
3. Run `npm ci`, `npm run validate`, and `npm audit`.
4. Do not commit TMDB tokens, fetched media payloads, copyrighted posters, or personal notes.
5. Open a pull request describing behavior, tests, privacy effects, and attribution effects.

Features involving TMDB account writes, commercial use, provider availability, or a credential proxy
need an explicit design and legal review before implementation.
