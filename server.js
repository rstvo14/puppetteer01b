import express from "express";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (_, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/healthz", (_, res) => res.send("ok"));

app.get("/screenshot", async (req, res) => {
  const pageUrl  = req.query.url      || `http://localhost:${PORT}`;
  const selector = req.query.selector || "#mapColumns";

  try {
    const browser = await puppeteer.launch({
      executablePath: await chromium.executablePath(),
      args: chromium.args,
      headless: chromium.headless,
      defaultViewport: chromium.defaultViewport
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

    res.type("png").send(png);
  } catch (err) {
    console.error(err);
    res.status(500).send("Screenshot failed");
  }
});

app.listen(PORT, () => console.log(`Server listening on ${PORT}`));