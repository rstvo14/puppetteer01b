import express from "express";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3000;

// ----- Change these if needed -----
const TARGET_URL       = process.env.TARGET_URL || `http://localhost:${PORT}`;
const DEFAULT_SELECTOR = process.env.SELECTOR   || "#mapColumns";
// ----------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Serve static files (e.g. index.html, styles, etc.) from "public" directory
app.use(express.static(path.join(__dirname, "public")));

// Basic routes
app.get("/", (_, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});
app.get("/healthz", (_, res) => {
  res.send("ok");
});

/**
 * /screenshot endpoint
 * Example usage:
 *   /screenshot?url=https://example.com&selector=#mapColumns&format=pdf
 */
app.get("/screenshot", async (req, res) => {
  const pageUrl = req.query.url || TARGET_URL;
  const selector = req.query.selector || DEFAULT_SELECTOR;
  const format   = req.query.format || "png"; // can be "pdf" or "png"

  let browser;
  try {
    // Launch Puppeteer using the @sparticuz/chromium settings
    browser = await puppeteer.launch({
      executablePath: await chromium.executablePath(),
      args: chromium.args,
      headless: chromium.headless,
      // You can change viewport if you like:
      defaultViewport: { width: 1400, height: 900 }
    });

    const page = await browser.newPage();
    // Remove Puppeteer’s default 30s limit so only the explicit 60s below applies
    page.setDefaultNavigationTimeout(0);

    // Navigate to the page, waiting up to 60s
    // "networkidle2" can cause indefinite waits if the site never goes fully idle; 
    // try "networkidle0", "domcontentloaded", or just remove waitUntil if needed.
    const navStart = Date.now();
    await page.goto(pageUrl, { waitUntil: "networkidle2", timeout: 60000 });
    console.log(`⏱️ Navigation time: ${(Date.now() - navStart) / 1000}s`);

    // -------- PDF Mode --------
    if (format === "pdf") {
      // Generate PDF without looking for a canvas element
      // If you need to wait for something specific to appear, 
      // add page.waitForSelector(...) here
      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true
      });

      await browser.close();
      res.set({
        "Content-Type": "application/pdf",
        "Content-Length": pdfBuffer.length
      });
      return res.send(pdfBuffer);
    }

    // -------- PNG Mode (Default) --------
    // If your page truly needs to wait for a canvas inside that selector:
    // (If it never appears, you’ll get a 15s timeout below)
    const waitStart = Date.now();
    await page.waitForSelector(`${selector} canvas`, { timeout: 15000 });
    console.log(`✅ Selector '${selector} canvas' ready in ${(Date.now() - waitStart) / 1000}s`);

    // If you only need to screenshot the parent container, remove 'canvas'
    // await page.waitForSelector(selector, { timeout: 15000 });

    // Grab the element we want to screenshot
    const element = await page.$(selector);
    if (!element) {
      throw new Error(`Selector '${selector}' not found on page`);
    }

    const captureStart = Date.now();
    const pngBuffer = await element.screenshot({ type: "png" });
    console.log(`📸 Screenshot captured in ${(Date.now() - captureStart) / 1000}s`);

    await browser.close();
    res.set({
      "Content-Type": "image/png",
      "Content-Length": pngBuffer.length
    });
    return res.send(pngBuffer);

  } catch (err) {
    console.error("Screenshot error:", err);
    if (browser) await browser.close();
    return res.status(500).send(`Screenshot failed: ${err.message}`);
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});