import express from "express";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import path from "path";
import { fileURLToPath } from "url";

const app  = express();
const PORT = process.env.PORT || 3000;

const TARGET_URL       = process.env.TARGET_URL || `http://localhost:${PORT}`;
const DEFAULT_SELECTOR = process.env.SELECTOR   || "#mapColumns";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, "public")));
app.get("/",      (_, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/healthz",(_, res) => res.send("ok"));

app.get("/screenshot", async (req, res) => {
  const pageUrl  = req.query.url      || TARGET_URL;
  const selector = req.query.selector || DEFAULT_SELECTOR;

  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: await chromium.executablePath("/tmp"),
      args: chromium.args,
      headless: chromium.headless,
      defaultViewport: { width: 1920, height: 1080 }
    });

    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(0);

    if (process.env.BASIC_AUTH_USER) {
      await page.authenticate({
        username: process.env.BASIC_AUTH_USER,
        password: process.env.BASIC_AUTH_PASS
      });
    }

    await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 0 });

    /* give Mapbox tiles & legends 10 s to finish */
    await new Promise(r => setTimeout(r, 10000));

    await page.waitForSelector(selector, { timeout: 15000 });

    const element = await page.$(selector);
    if (!element) throw new Error(`Selector '${selector}' not found`);

    const png = await element.screenshot({ type: "png" });
    await browser.close();
    res.type("png").send(png);

  } catch (err) {
    console.error("Screenshot error:", err);
    if (browser) await browser.close();
    res.status(500).send(`Screenshot failed: ${err.message}`);
  }
});

app.listen(PORT, () => console.log(`Server listening on ${PORT}`));