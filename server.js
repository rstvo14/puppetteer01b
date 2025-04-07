import express   from "express";
import puppeteer  from "puppeteer";
import path       from "path";
import { fileURLToPath } from "url";

const app  = express();
const PORT = process.env.PORT || 3000;

/* ----------  serve static assets  ---------- */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, "public")));

/* send index.html at "/" even though it lives at repo root */
app.get("/", (_, res) => res.sendFile(path.join(__dirname, "index.html")));

/* ----------  health check  ---------- */
app.get("/healthz", (_, res) => res.send("ok"));

/* ----------  screenshot API  ----------
   GET /screenshot?url=<pageUrl>&selector=<cssSelector>
----------------------------------------- */
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

    res.type("png").send(png);
  } catch (err) {
    console.error(err);
    res.status(500).send("Screenshot failed – see server logs");
  }
});

/* ----------  start server  ---------- */
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));