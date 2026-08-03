# Security policy

## Supported versions

Security fixes are provided for the latest published major version.

## Credential model

ScreenCard is a browser application, so a user-supplied TMDB token is available to that browser
while in use. Session-only storage is the default. Remembering a token writes it to local storage and
is inappropriate on a shared or untrusted device. Tokens are never placed in URLs, exports, logs, or
repository files by ScreenCard.

## Reporting a vulnerability

Use GitHub private vulnerability reporting. Do not open a public issue that contains a token,
personal research note, browser-storage dump, or reproducible exploit against an active deployment.

Include the affected version, browser, reproduction steps, and impact using dummy credentials and
non-sensitive data.
