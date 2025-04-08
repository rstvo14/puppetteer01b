import express from "express";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3000;

const TARGET_URL       = process.env.TARGET_URL || `http://localhost:${PORT}`;
const DEFAULT_SELECTOR = process.env.SELECTOR   || "#mapColumns";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (_, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/healthz", (_, res) => res.send("ok"));

app.get("/screenshot", async (req, res) => {
  // Pull in query params
  const pageUrl  = req.query.url      || TARGET_URL;
  const selector = req.query.selector || DEFAULT_SELECTOR;
  // This allows "?format=pdf" or "?format=png"
  const format   = req.query.format   || "png";

  let browser;
  try {
    // ===== Keep your ORIGINAL LAUNCH SETTINGS (unchanged) =====
    browser = await puppeteer.launch({
      executablePath: await chromium.executablePath(),
      args: chromium.args,
      headless: chromium.headless,
      defaultViewport: { width: 1400, height: 900 }
    });

    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(0); // remove puppeteer’s default 30s limit

    // Navigate (60s max)
    const navStart = Date.now();
    await page.goto(pageUrl, { waitUntil: "networkidle2", timeout: 60000 });
    console.log(`⏱️ Navigation time: ${(Date.now() - navStart) / 1000}s`);

    // ------- PDF Mode -------
    if (format === "pdf") {
      // If you need to wait for a specific selector before PDF,
      // insert a wait here, e.g.: await page.waitForSelector("#something");
      const pdfStart = Date.now();
      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true
        // You can add other PDF options here
      });
      console.log(`📝 PDF captured in ${(Date.now() - pdfStart) / 1000}s`);

      await browser.close();
      res.set({
        "Content-Type": "application/pdf",
        "Content-Length": pdfBuffer.length
      });
      return res.send(pdfBuffer);
    }

    // ------- PNG Mode (same as your original code) -------
    const waitStart = Date.now();
    await page.waitForSelector(`${selector} canvas`, { timeout: 15000 });
    console.log(`✅ Selector ready in ${(Date.now() - waitStart) / 1000}s`);

    const element = await page.$(selector);
    if (!element) throw new Error(`Selector '${selector}' not found`);

    const captureStart = Date.now();
    const png = await element.screenshot({ type: "png" });
    console.log(`📸 Screenshot captured in ${(Date.now() - captureStart) / 1000}s`);

    await browser.close();

    res.set({
      "Content-Type": "image/png",
      "Content-Length": png.length
    });
    return res.send(png);

  } catch (err) {
    console.error("Screenshot error:", err);
    if (browser) await browser.close();
    return res.status(500).send(`Screenshot failed: ${err.message}`);
  }
});

app.listen(PORT, () => console.log(`Server listening on ${PORT}`));