const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use('/static', express.static(path.join(__dirname, 'static')));

app.get('/', (req, res) => {
  res.send(`<h2>Use /screenshot?url=URL&selector=CSS_SELECTOR to get an image</h2>`);
});

app.get('/screenshot', async (req, res) => {
  const { url, selector } = req.query;

  if (!url || !selector) {
    return res.status(400).send('Missing "url" or "selector" parameter');
  }

  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });

    await page.waitForSelector(selector, { timeout: 10000 });
    const element = await page.$(selector);

    const screenshot = await element.screenshot({ type: 'png' });
    await browser.close();

    res.setHeader('Content-Type', 'image/png');
    res.send(screenshot);

  } catch (error) {
    console.error(error);
    res.status(500).send('Screenshot failed: ' + error.message);
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});