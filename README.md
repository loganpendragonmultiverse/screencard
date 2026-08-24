# ScreenCard

ScreenCard is a local-first movie and TV research desk powered by your own TMDB API Read Access
Token. Search for titles, organize a device-local viewing library, compare up to four complete research cards,
add private notes, and export the result as Markdown or JSON.

There is no ScreenCard server, account, analytics, advertising, or tracking. The production build is
a static site that can run from GitHub Pages, any ordinary web host, or a local static server.

## What makes it useful

- Search movies and TV series together without mixing people into the results.
- Compare rating, runtime or episode structure, status, genres, directors or lead producers, cast,
  synopsis, trailers, and TMDB pages side by side.
- Organize titles into named local lists with viewing state, priority, personal rating, and tags.
- Add private research notes to comparison cards.
- Export comparison cards and notes as portable Markdown or versioned JSON.
- Sort comparisons, highlight meaningful differences, and save reusable comparison sets.
- Export or merge a versioned local backup with a conflict preview before incoming values win.
- Create shareable research exports that deliberately omit private notes.
- Cache fetched TMDB responses for 24 hours to reduce repeated requests.
- Keep the API token session-only by default, with an explicit remember-on-this-device option.
- Self-host the compiled static files without a database or backend.

## Try it

The public build is published at:

<https://loganpendragonmultiverse.github.io/screencard/>

You need a TMDB API Read Access Token before searches will work. ScreenCard does not include or
proxy a shared token.

## Get a TMDB token

1. Create or sign in to a [TMDB account](https://www.themoviedb.org/signup).
2. Open the API section of your TMDB account settings and request developer API access.
3. Copy the **API Read Access Token** (the long Bearer token, not a username or password).
4. Open ScreenCard, select **Token**, paste it, and decide whether it should persist on the device.

Treat this token like a password. Session-only storage is the safer option on shared computers.
ScreenCard sends it only as a Bearer token to `https://api.themoviedb.org`.

## Run locally

Requirements: Node.js 20.19 or later and npm.

```shell
npm ci
npm run dev
```

Build and validate the production package:

```shell
npm run validate
npm run preview
```

The deployable static site is written to `dist/`.

## Self-host

Run `npm run build`, then serve the contents of `dist/` from an HTTPS website or a local static
server. ScreenCard uses relative assets, so it can live at a domain root or a subdirectory. The host
must allow browser connections to:

- `https://api.themoviedb.org`
- `https://image.tmdb.org`

No server-side environment variables are required. Do not bake a private token into a public build.

## Local data and exports

ScreenCard uses browser `sessionStorage` and `localStorage`:

| Data                | Default location | Notes                                                    |
| ------------------- | ---------------- | -------------------------------------------------------- |
| TMDB token          | Session storage  | Moves to local storage only when “Remember” is checked.  |
| Library             | Local storage    | IDs, named lists, viewing state, priority, rating, tags. |
| Research notes      | Local storage    | Plain text, never transmitted by ScreenCard.             |
| Comparison sets     | Local storage    | Names and TMDB movie/TV references.                      |
| TMDB response cache | Local storage    | Expires after 24 hours.                                  |

Markdown and JSON exports are created entirely in the browser. They can contain TMDB data and your
notes, so review them before sharing.

## Limitations

- ScreenCard needs a user-supplied TMDB developer token and an internet connection for uncached
  title data and images.
- A browser application cannot hide a token from someone who controls that browser or device.
- Libraries do not synchronize automatically between devices and do not integrate with a TMDB
  user account. Versioned backup files can be moved manually and expose a merge summary first.
- Ratings are TMDB community ratings, not personal recommendations or review scores.
- Availability by streaming provider is deliberately outside version 1; showing that data would add
  separate JustWatch attribution and regional-state requirements.
- TMDB controls its API availability, rate limits, data, and images.

## Current release

Version 1.1.0 adds named libraries, viewing states, ratings, priorities and tags; sortable
difference-aware comparisons and saved sets; merge-preview backups; and note-free share exports.

## Attribution

This product uses the TMDB API but is not endorsed or certified by TMDB.

The included TMDB logo is an approved attribution asset from TMDB's official logo page. TMDB data,
images, name, and logo remain subject to TMDB's terms and the rights of their respective owners.

## Project documents

- [DEVELOPMENT.md](DEVELOPMENT.md)
- [TESTING.md](TESTING.md)
- [PRIVACY.md](PRIVACY.md)
- [SECURITY.md](SECURITY.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)
- [SUPPORT.md](SUPPORT.md)

## License

ScreenCard's original source code is available under the [MIT License](LICENSE). That license does
not grant rights to TMDB content, images, name, or logo.

## More open-source projects

ScreenCard is part of the [Logan Pendragon Forge open-source collection](https://www.loganpendragonforge.com/open-source/).
