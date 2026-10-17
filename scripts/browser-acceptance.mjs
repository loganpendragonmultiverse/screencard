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
try {
  for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
    const browser = await engine.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    const remote = [];
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
      const selector = () => page.getByRole('combobox', { name: /^Saved comparison set$/i });
      const checkName = async () => {
        assert.equal(await selector().count(), 1);
        assert.equal(await selector().isVisible(), true);
        assert.equal(
          await page.locator('#saved-comparison').evaluate((element) => element.labels.length),
          1,
        );
        assert.equal(
          await page.locator('label[for="saved-comparison"]').textContent(),
          'Saved comparison set',
        );
      };
      await page.goto(origin);
      await page.locator('[data-action="demo"]').click();
      await page.locator('[data-action="compare"]').first().click();
      await page.locator('[data-view="compare"]').click();
      await checkName();
      await page.locator('[data-action="save-comparison"]').click();
      await page.locator('#item-name').fill('Offline research');
      await page.locator('#name-form button[type="submit"]').click();
      const id = await selector().locator('option').nth(1).getAttribute('value');
      await page.reload();
      await page.locator('[data-view="compare"]').click();
      assert.equal(await page.locator('.comparison-card').count(), 0);
      await checkName();
      await selector().selectOption(id);
      await page.waitForFunction(
        () => globalThis.document.querySelectorAll('.comparison-card').length === 1,
      );
      await checkName();
      await page.locator('[data-action="rename-comparison"]').click();
      await page.locator('#item-name').fill('Renamed research');
      await page.locator('#name-form button[type="submit"]').click();
      assert.match(await selector().textContent(), /Renamed research/);
      page.once('dialog', (dialog) => dialog.accept());
      await page.locator('[data-action="delete-comparison"]').click();
      assert.equal(await selector().locator('option').count(), 1);
      assert.equal(await page.locator('.comparison-card').count(), 1);
      await checkName();
      await page.setViewportSize({ width: 390, height: 844 });
      assert(
        await page.evaluate(
          () => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth + 2,
        ),
      );
      assert.deepEqual(errors, []);
      assert.deepEqual(remote, []);
      results.push({
        engine: name,
        status: 'passed',
        namedSelector: true,
        savedSetReloadRenameDelete: true,
        remoteRequests: 0,
      });
    } catch (error) {
      results.push({ engine: name, status: 'failed', error: String(error) });
    } finally {
      await context.close();
      await browser.close();
    }
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}
if (process.env.SCREENCARD_BROWSER_REPORT) {
  await fs.writeFile(
    process.env.SCREENCARD_BROWSER_REPORT,
    JSON.stringify(results, null, 2) + '\n',
  );
}
log(JSON.stringify(results, null, 2));
assert.equal(results.filter((result) => result.status !== 'passed').length, 0);
