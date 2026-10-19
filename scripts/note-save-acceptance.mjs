import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { log } from 'node:console';
import { URL } from 'node:url';

const { chromium, firefox, webkit } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const siteRoot = path.resolve(process.env.SCREENCARD_DIST || 'dist');
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
try {
  for (const [engine, type] of Object.entries({ chromium, firefox, webkit })) {
    const browser = await type.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [],
      remote = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    await page.route('**/*', (route) => {
      if (
        route
          .request()
          .url()
          .startsWith(origin + '/')
      )
        return route.continue();
      remote.push(route.request().url());
      return route.abort();
    });
    try {
      await page.goto(origin);
      await page.locator('[data-action="demo"]').click();
      await page.locator('[data-action="compare"]').first().click();
      await page.locator('[data-view="compare"]').click();
      await page.locator('[data-note]').fill('PRIVATE ORIGINAL');
      await page.locator('[data-note]').blur();
      assert.match(await page.locator('.toast').innerText(), /saved locally/);
      const original = await page.evaluate(() =>
        globalThis.localStorage.getItem('screencard:notes:v1'),
      );
      const capacity = await page.evaluate(() => {
        let keys = 0;
        const phases = [];
        for (const size of [100000, 1000, 10]) {
          let added = 0;
          try {
            for (; added < 2000; added++, keys++)
              globalThis.localStorage.setItem('audit:quota:' + keys, 'q'.repeat(size));
          } catch (error) {
            phases.push({ size, added, error: error.name });
          }
        }
        return { keys, phases };
      });
      assert(capacity.phases.some((phase) => phase.error === 'QuotaExceededError'));
      const draft = 'UNSAVED NEW NOTE '.repeat(15);
      await page.locator('[data-note]').fill(draft);
      await page.locator('[data-note]').blur();
      assert.match(
        await page.locator('[data-note-status]').innerText(),
        /Could not save.*unsaved draft/,
      );
      assert.equal(await page.locator('[data-note]').inputValue(), draft);
      assert.equal(
        await page.evaluate(() => globalThis.localStorage.getItem('screencard:notes:v1')),
        original,
      );
      await page.locator('[data-view="watchlist"]').click();
      assert.match(await page.locator('main').innerText(), /Unsaved research notes remain/);
      await page.locator('[data-view="compare"]').click();
      assert.equal(await page.locator('[data-note]').inputValue(), draft);
      assert.match(await page.locator('[data-note-status]').innerText(), /Could not save/);
      await page.getByRole('button', { name: 'Retry saving note', exact: true }).click();
      assert.match(await page.locator('[data-note-status]').innerText(), /Could not save/);
      assert.equal(
        await page.evaluate(() => globalThis.localStorage.getItem('screencard:notes:v1')),
        original,
      );
      await page.evaluate(() => {
        for (const key of Object.keys(globalThis.localStorage))
          if (key.startsWith('audit:quota:')) globalThis.localStorage.removeItem(key);
      });
      await page.getByRole('button', { name: 'Retry saving note', exact: true }).click();
      assert.match(await page.locator('.toast').innerText(), /saved locally/);
      assert.equal(await page.locator('[data-note-status]').innerText(), '');
      assert.equal(
        await page.getByRole('button', { name: 'Retry saving note', exact: true }).count(),
        0,
      );
      assert.equal(
        JSON.parse(
          await page.evaluate(() => globalThis.localStorage.getItem('screencard:notes:v1')),
        )['movie:-9001'],
        draft,
      );
      await page.reload();
      await page.locator('[data-action="demo"]').click();
      await page.locator('[data-action="compare"]').first().click();
      await page.locator('[data-view="compare"]').click();
      assert.equal(await page.locator('[data-note]').inputValue(), draft);
      for (const width of [390, 1280]) {
        await page.setViewportSize({ width, height: 844 });
        assert(
          await page.evaluate(
            () => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth + 2,
          ),
        );
      }
      assert.deepEqual(errors, []);
      assert.deepEqual(remote, []);
      results.push({
        engine,
        passed: true,
        actualBrowserQuota: capacity,
        draftLength: draft.length,
        failedSaveVisible: true,
        priorPersistedNotePreserved: true,
        internalNavigationDraftPreserved: true,
        failedRetryPreserved: true,
        retryAfterFreeingSyntheticStorage: true,
        reloadPersisted: true,
        viewports: [390, 1280],
        pageErrors: errors,
        remoteRequests: remote,
        realProvider: 'USER_REPORTED_NOT_REPRODUCED',
      });
    } finally {
      await context.close();
      await browser.close();
    }
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}
if (process.env.SCREENCARD_NOTE_REPORT)
  await fs.writeFile(process.env.SCREENCARD_NOTE_REPORT, JSON.stringify(results, null, 2) + '\n');
log(JSON.stringify(results, null, 2));
