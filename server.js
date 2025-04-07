import express from "express";
import puppeteer from "puppeteer";

const app  = express();
const PORT = process.env.PORT || 3000;
const CHROME = process.env.CHROME_BIN || "/usr/bin/google-chrome";

app.use(express.static("public"));
app.get("/healthz", (_, res) => res.send("ok"));
app.get("/screenshot", async (req, res) => {
  const pageUrl  = req.query.url      || `http://localhost:${PORT}`;
  const selector = req.query.selector || "#mapColumns";

  try {
    const browser = await puppeteer.launch({
      executablePath: CHROME,
      args: ["--no-sandbox", "--disable-setuid-sandbox",
             "--disable-gpu", "--disable-dev-shm-usage"]
    });

    const page = await browser.newPage();
    await page.goto(pageUrl, { waitUntil: "networkidle0" });

    const el = await page.$(selector);
    if (!el) {
      await browser.close();
      return res.status(404).send(`Selector '${selector}' not found`);
    }

    const png = await el.screenshot({ type: "png" });
    await browser.close();

    res.set("Content-Type", "image/png");
    res.send(png);
  } catch (err) {
    console.error(err);
    res.status(500).send("Screenshot failed");
  }
});

app.listen(PORT, () => console.log(`Server listening on ${PORT}`));