const fs        = require('fs');
const path      = require('path');
const express   = require('express');
const puppeteer = require('puppeteer-core');

const app  = express();
const PORT = process.env.PORT || 3000;

/* ---------- helpers ---------- */
function findChromium() {
  const candidates = ['/usr/bin/chromium', '/usr/bin/chromium-browser'];
  return candidates.find(fs.existsSync);
}

/* ---------- static files ---------- */
app.use('/static', express.static(path.join(__dirname, 'static')));

/* ---------- root ---------- */
app.get('/', (_req, res) =>
  res.send('<h2>Use /screenshot?url=URL&selector=CSS_SELECTOR to get an image</h2>')
);

/* ---------- screenshot API ---------- */
app.get('/screenshot', async (req, res) => {
  const { url, selector } = req.query;
  if (!url || !selector) {
    return res.status(400).send('Missing “url” or “selector” parameter');
  }

  const chromePath = findChromium();
  if (!chromePath) {
    console.error('Chromium not found in container');
    return res.status(500).send('Chromium not installed');
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath: chromePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30_000 });
    await page.waitForSelector(selector, { timeout: 10_000 });

    const el = await page.$(selector);
    if (!el) throw new Error(`Selector “${selector}” not found`);

    const png = await el.screenshot({ type: 'png' });
    res.type('png').send(png);
  } catch (err) {
    console.error('[screenshot] failed:', err);
    res.status(500).send(`Screenshot failed: ${err.message}`);
  } finally {
    if (browser) await browser.close();
  }
});

/* ---------- start ---------- */
app.listen(PORT, () =>
  console.log(`Server listening on http://localhost:${PORT}`)
);