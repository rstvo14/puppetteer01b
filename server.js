import express from "express";
import puppeteer from "puppeteer";

const app  = express();
const PORT = process.env.PORT || 3000;

/* ────────────  Static site  ──────────── */
app.use(express.static("public"));

/* ────────────  Health check  ─────────── */
app.get("/healthz", (_, res) => res.send("ok"));

/* ────────────  Screenshot API  ─────────
   GET /screenshot?url=<pageUrl>&selector=<cssSelector>
   • url      – absolute URL to load  (defaults to this service root)
   • selector – CSS selector to grab  (defaults to #mapColumns)
*/
app.get("/screenshot", async (req, res) => {
  const pageUrl  = req.query.url      || `http://localhost:${PORT}`;
  const selector = req.query.selector || "#mapColumns";

  try {
    const browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();
    await page.goto(pageUrl, { waitUntil: "networkidle0" });

    const element = await page.$(selector);
    if (!element) {
      await browser.close();
      return res.status(404).send(`Selector '${selector}' not found`);
    }

    const png = await element.screenshot({ type: "png" });
    await browser.close();

    res.set("Content-Type", "image/png");
    res.send(png);
  } catch (err) {
    console.error(err);
    res.status(500).send("Screenshot failed");
  }
});

/* ────────────  Start server  ─────────── */
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));