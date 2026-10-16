const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..', 'dist');
const base = '/huixin-gallery-web/';
const types = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.webmanifest':'application/manifest+json', '.svg':'image/svg+xml', '.webp':'image/webp', '.png':'image/png', '.woff2':'font/woff2'};
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (!url.pathname.startsWith(base)) { res.writeHead(404).end(); return; }
  const relative = decodeURIComponent(url.pathname.slice(base.length)) || 'index.html';
  const file = path.resolve(root, relative);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
(async () => {
  await new Promise(resolve => server.listen(5894, '127.0.0.1', resolve));
  let browser;
  try {
    const executablePath = process.env.HUIXIN_BROWSER || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
    browser = await chromium.launch({headless:true, ...(executablePath ? {executablePath} : {})});
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [], failed = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('response', r => { if (r.status() >= 400) failed.push(r.url()); });
    await page.goto(`http://127.0.0.1:5894${base}`, {waitUntil:'networkidle'});
    await page.getByRole('navigation').first().waitFor({timeout:10000});
    await page.waitForFunction(() => [...document.querySelectorAll('img')].some(img => img.src.includes('home.webp') && img.complete && img.naturalWidth > 0));
    for (const space of ['book','film','music','game','person']) {
      await page.locator(`a[href="#/${space}"]`).first().click();
      await page.waitForFunction(name => [...document.querySelectorAll('img')].some(img => img.src.includes(`${name}.webp`) && img.complete && img.naturalWidth > 0), space);
    }
    const manifest = await (await fetch(`http://127.0.0.1:5894${base}manifest.webmanifest`)).json();
    assert.equal(new URL(manifest.start_url, `http://localhost${base}`).pathname, base);
    assert.equal(new URL(manifest.scope, `http://localhost${base}`).pathname, base);
    for (const icon of manifest.icons) {
      const address = new URL(icon.src, `http://127.0.0.1:5894${base}`);
      assert.ok(address.pathname.startsWith(base));
      assert.equal((await fetch(address)).status, 200);
    }
    const count = await page.evaluate(() => new Promise((resolve, reject) => {
      const request = indexedDB.open('huixin-gallery');
      request.onsuccess = () => {
        const db = request.result;
        const q = db.transaction('collections').objectStore('collections').count();
        q.onsuccess = () => {resolve(q.result); db.close();}; q.onerror = () => reject(q.error);
      };
      request.onerror = () => reject(request.error);
    }));
    assert.equal(count, 0, 'public site starts empty');
    const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
    assert.ok(scope.endsWith(base));
    await page.reload({waitUntil:'networkidle'});
    await context.setOffline(true);
    await page.reload({waitUntil:'domcontentloaded'});
    await page.getByRole('navigation').first().waitFor();
    assert.deepEqual(errors, []);
    assert.deepEqual(failed, []);
    console.log('PASS Pages: subpath navigation, six images, PWA icons/scope, empty collection database and offline reload');
    await context.close();
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => {console.error(error); process.exitCode = 1;});
