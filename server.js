import express from "express";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import path from "path";
import os from "os";
import fs from "fs";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3000;

const TARGET_URL       = process.env.TARGET_URL || `http://localhost:${PORT}`;
const DEFAULT_SELECTOR = process.env.SELECTOR   || "#mapColumns";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (_, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/healthz", (_, res) => res.send("ok"));

// Use a persistent temporary copy of the Chromium executable
let persistentExecutable = null;
async function getPersistentExecutable() {
  if (persistentExecutable) return persistentExecutable;
  const originalPath = await chromium.executablePath();
  // Create a dedicated temporary directory for our Chromium copy
  const tempDir = path.join(os.tmpdir(), "puppeteer-chromium");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  // Use a consistent filename so the file is reused between requests
  persistentExecutable = path.join(tempDir, "chromium-copy");
  // Only copy if it doesn't already exist
  if (!fs.existsSync(persistentExecutable)) {
    fs.copyFileSync(originalPath, persistentExecutable);
    // Ensure the file is executable
    fs.chmodSync(persistentExecutable, 0o755);
  }
  return persistentExecutable;
}

app.get("/screenshot", async (req, res) => {
  const pageUrl  = req.query.url      || TARGET_URL;
  const selector = req.query.selector || DEFAULT_SELECTOR;
  const format   = req.query.format   || "png";   // "png" (default) or "pdf"

  let browser;
  try {
    const execPath = await getPersistentExecutable();
    browser = await puppeteer.launch({
      executablePath: execPath,
      args: chromium.args,
      headless: chromium.headless,
      defaultViewport: { width: 1400, height: 900 }
    });

    const page = await browser.newPage();
    // Increase the navigation timeout to 120 seconds
    page.setDefaultNavigationTimeout(120000);

    const navStart = Date.now();
    // Using the "load" event here helps if networkidle conditions are not met
    await page.goto(pageUrl, { waitUntil: "load", timeout: 120000 });
    console.log(`⏱️ Navigation time: ${(Date.now() - navStart) / 1000}s`);

    // PDF mode if ?format=pdf
    if (format === "pdf") {
      const pdfStart = Date.now();
      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true
      });
      console.log(`📝 PDF generated in ${(Date.now() - pdfStart) / 1000}s`);
      await browser.close();
      res.set({
        "Content-Type": "application/pdf",
        "Content-Length": pdfBuffer.length
      });
      return res.send(pdfBuffer);
    }

    // PNG mode (default)
    const waitStart = Date.now();
    // Increase selector wait timeout to 30 seconds
    await page.waitForSelector(`${selector} canvas`, { timeout: 30000 });
    console.log(`✅ Selector ready in ${(Date.now() - waitStart) / 1000}s`);

    const element = await page.$(selector);
    if (!element) throw new Error(`Selector '${selector}' not found`);

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
    res.status(500).send(`Screenshot failed: ${err.message}`);
  }
});

app.listen(PORT, () => console.log(`Server listening on ${PORT}`));