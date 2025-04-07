// server.js
const express   = require('express');
const puppeteer = require('puppeteer');
const path      = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

/* ---------- static files ---------- */
app.use('/static', express.static(path.join(__dirname, 'static')));

/* ---------- root route ---------- */
app.get('/', (_req, res) => {
  res.send('<h2>Use /screenshot?url=URL&selector=CSS_SELECTOR to get an image</h2>');
});

/* ---------- screenshot API ---------- */
app.get('/screenshot', async (req, res) => {
  const { url, selector } = req.query;
  if (!url || !selector) {
    return res.status(400).send('Missing “url” or “selector” parameter');
  }

  let browser;
  try {
    console.info('[screenshot] request', { url, selector });

    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30_000 });
    await page.waitForSelector(selector, { timeout: 10_000 });

    const element = await page.$(selector);
    if (!element) throw new Error(`Element with selector “${selector}” not found`);

    const png = await element.screenshot({ type: 'png' });
    res.type('png').send(png);
  } catch (err) {
    console.error('[screenshot] failed:', err);
    res.status(500).send(`Screenshot failed: ${err.message}`);
  } finally {
    if (browser) await browser.close();
  }
});

/* ---------- start server ---------- */
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});