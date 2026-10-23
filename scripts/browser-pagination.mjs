import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { log } from 'node:console';
import { URL } from 'node:url';

// Optional runtime: no dependency is installed or downloaded by this script.
const { chromium, firefox, webkit } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const siteRoot = path.resolve(process.env.SCREENCARD_DIST || 'dist');
await fs.access(path.join(siteRoot, 'index.html'));
const server = http.createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const file = path.resolve(
    siteRoot,
    `.${pathname.endsWith('/') ? `${pathname}index.html` : pathname}`,
  );
  if (!file.startsWith(siteRoot + path.sep)) {
    response.writeHead(403).end();
    return;
  }
  try {
    const types = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
    response.setHeader('Content-Type', types[path.extname(file)] || 'text/html');
    response.end(await fs.readFile(file));
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const results = [];
const output = process.env.SCREENCARD_BROWSER_REPORT;
const card = (id, title, media_type = 'movie') => ({
  id,
  title,
  name: title,
  media_type,
  overview: 'Fictional fixture',
  poster_path: null,
  backdrop_path: null,
  release_date: '2026-01-01',
  vote_average: 7,
  genres: [],
  runtime: 90,
  status: 'Released',
  tagline: '',
  homepage: '',
  credits: { cast: [], crew: [] },
  videos: { results: [] },
});
try {
  for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
    const browser = await engine.launch({ headless: true });
    for (const width of [1400, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      const errors = [],
        calls = [],
        unexpected = [];
      let failNext = true,
        delayed;
      page.on('pageerror', (e) => errors.push(e.message));
      await page.route('**/*', async (route) => {
        const url = new URL(route.request().url());
        if (url.origin === origin) return route.continue();
        if (url.origin !== 'https://api.themoviedb.org') {
          unexpected.push(url.origin);
          return route.abort();
        }
        assert.equal(
          route.request().headers().authorization,
          'Bearer synthetic-pagination-fixture',
        );
        if (!url.pathname.endsWith('/search/multi'))
          return route.fulfill({ json: card(30, 'Third page title', 'tv') });
        const query = url.searchParams.get('query'),
          number = Number(url.searchParams.get('page'));
        calls.push({ query, number });
        if (query === 'slow') {
          delayed = route;
          return;
        }
        if (query === 'alpha' && number === 2 && failNext) {
          failNext = false;
          return route.fulfill({ status: 429, body: '' });
        }
        const data =
          query === 'alpha'
            ? number === 1
              ? [card(10, 'First page title')]
              : number === 2
                ? [{ id: 99, media_type: 'person' }]
                : [card(30, 'Third page title', 'tv')]
            : [card(40, 'New query title')];
        return route.fulfill({
          json: { page: number, total_pages: query === 'alpha' ? 3 : 1, results: data },
        });
      });
      try {
        await page.goto(origin);
        await page.locator('[data-action="settings"]').click();
        await page.locator('#token-input').fill('synthetic-pagination-fixture');
        await page.locator('#token-form').evaluate((form) => form.requestSubmit());
        const submit = async (query) => {
          await page.locator('#search-input').fill(query);
          await page.locator('#search-form').evaluate((form) => form.requestSubmit());
        };
        const label = page.locator('[aria-label="Search result pages"] [role="status"]');
        const waitLabel = async (value) => {
          await page.waitForFunction(
            (v) =>
              globalThis.document
                .querySelector('[aria-label="Search result pages"] [role="status"]')
                ?.textContent.includes(v),
            value,
          );
        };
        await submit('alpha');
        await waitLabel('Page 1 of 3');
        assert(await page.locator('[data-action="search-previous"]').isDisabled());
        assert.equal(await page.locator('#search-input').inputValue(), 'alpha');
        await page.locator('[data-action="search-next"]').click();
        await page.waitForFunction(() =>
          globalThis.document.body.textContent.includes('rate limit reached'),
        );
        assert((await label.textContent()).includes('Page 1 of 3'));
        assert.equal(await page.locator('.result-card h3').textContent(), 'First page title');
        await page.locator('[data-action="search-next"]').click();
        await waitLabel('Page 2 of 3');
        assert.equal(await page.locator('.result-card').count(), 0);
        assert(!(await page.locator('[data-action="search-next"]').isDisabled()));
        await page.locator('[data-action="search-next"]').click();
        await waitLabel('Page 3 of 3');
        assert(await page.locator('[data-action="search-next"]').isDisabled());
        await page.locator('[data-action="watch"]').click();
        assert((await page.locator('[data-action="watch"]').textContent()).includes('Watchlist'));
        await page.locator('[data-action="compare"]').click();
        await page.waitForFunction(() =>
          globalThis.document
            .querySelector('[data-action="compare"]')
            ?.textContent.includes('Selected'),
        );
        const requests = calls.length;
        await page.locator('[data-action="search-previous"]').click();
        await waitLabel('Page 2 of 3');
        await page.locator('[data-action="search-previous"]').click();
        await waitLabel('Page 1 of 3');
        assert.equal(calls.length, requests);
        await submit('beta');
        await waitLabel('Page 1 of 1');
        assert((await label.textContent()).includes('beta'));
        assert.equal(await page.locator('.result-card h3').textContent(), 'New query title');
        await submit('slow');
        await page.waitForFunction(
          () => globalThis.document.querySelector('#search-form button')?.disabled,
        );
        for (let n = 0; !delayed && n < 100; n++)
          await new Promise((resolve) => globalThis.setTimeout(resolve, 20));
        assert(delayed);
        await page.locator('[data-action="demo"]').click();
        const demos = await page.locator('.result-card h3').allTextContents();
        assert.equal(demos.length, 3);
        await delayed.fulfill({
          json: { page: 1, total_pages: 1, results: [card(55, 'Stale title')] },
        });
        await page.waitForTimeout(100);
        assert.deepEqual(await page.locator('.result-card h3').allTextContents(), demos);
        assert.equal(await page.locator('[aria-label="Search result pages"]').count(), 0);
        assert.equal(await page.locator('#search-input').inputValue(), 'slow');
        assert.equal(
          await page.evaluate(
            () => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth,
          ),
          true,
        );
        assert.deepEqual(errors, []);
        assert.deepEqual(unexpected, []);
        results.push({ engine: name, width, status: 'passed', requests: calls });
        log('PASS pagination', name, width);
      } finally {
        await context.close();
      }
    }
    await browser.close();
  }
  if (output) await fs.writeFile(output, JSON.stringify(results, null, 2));
} finally {
  await new Promise((resolve) => server.close(resolve));
}
