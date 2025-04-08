import express from "express";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import path from "path";
import os from "os";
import fs from "fs";
import { fileURLToPath } from "url";
import PDFDocument from "pdfkit"; // PDFKit dependency

const app = express();
const PORT = process.env.PORT || 3000;

const TARGET_URL = process.env.TARGET_URL || `http://localhost:${PORT}`;
const DEFAULT_SELECTOR = process.env.SELECTOR || "#mapColumns";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (_, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/healthz", (_, res) => res.send("ok"));

// Create or retrieve a persistent temporary copy of the Chromium executable
let persistentExecutable = null;
async function getPersistentExecutable() {
  if (persistentExecutable) return persistentExecutable;
  const originalPath = await chromium.executablePath();
  const tempDir = path.join(os.tmpdir(), "puppeteer-chromium");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  persistentExecutable = path.join(tempDir, "chromium-copy");
  if (!fs.existsSync(persistentExecutable)) {
    fs.copyFileSync(originalPath, persistentExecutable);
    fs.chmodSync(persistentExecutable, 0o755);
  }
  return persistentExecutable;
}

app.get("/screenshot", async (req, res) => {
  const pageUrl = req.query.url || TARGET_URL;
  const selector = req.query.selector || DEFAULT_SELECTOR;
  const format = req.query.format || "png"; // "png" (default) or "pdf"

  let browser;
  try {
    const execPath = await getPersistentExecutable();
    browser = await puppeteer.launch({
      executablePath: execPath,
      args: chromium.args,
      headless: chromium.headless,
      defaultViewport: { width: 1400, height: 900 },
    });

    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(120000); // allow up to 120 seconds
    await page.goto(pageUrl, { waitUntil: "load", timeout: 120000 });
    console.log("Page loaded");

    // Wait for a canvas element inside the target element to be rendered.
    await page.waitForSelector(`${selector} canvas`, { timeout: 30000 });
    const element = await page.$(selector);
    if (!element) throw new Error(`Selector '${selector}' not found`);

    // Capture the element's screenshot as PNG.
    const pngBuffer = await element.screenshot({ type: "png" });
    console.log("Element screenshot captured");

    if (format === "png") {
      await browser.close();
      res.set({
        "Content-Type": "image/png",
        "Content-Length": pngBuffer.length,
      });
      return res.send(pngBuffer);
    } else if (format === "pdf") {
      // Convert the PNG screenshot to a PDF using PDFKit.
      const doc = new PDFDocument({ autoFirstPage: false });
      const buffers = [];
      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", async () => {
        const pdfBuffer = Buffer.concat(buffers);
        await browser.close();
        res.set({
          "Content-Type": "application/pdf",
          "Content-Length": pdfBuffer.length,
        });
        return res.send(pdfBuffer);
      });

      // Set the PDF page size to match your PNG dimensions.
      const pageWidth = 865; // adjust if needed
      const pageHeight = 500; // adjust if needed
      doc.addPage({ size: [pageWidth, pageHeight] });
      doc.image(pngBuffer, 0, 0, { width: pageWidth, height: pageHeight });
      doc.end();
    }
  } catch (err) {
    console.error("Screenshot error:", err);
    if (browser) await browser.close();
    res.status(500).send(`Screenshot failed: ${err.message}`);
  }
});

app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
