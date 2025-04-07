import express from "express";
import puppeteer from "puppeteer";

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static assets
app.use(express.static("public"));

// Health check
app.get("/healthz", (_, res) => res.send("ok"));

// Screenshot endpoint – returns PNG of #mapColumns
app.get("/api/screenshot", async (_, res) => {
  try {
    const browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
    const page = await browser.newPage();

    // Render will inject PORT; PUBLIC_URL is optional for custom domains
    const target = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
    await page.goto(target, { waitUntil: "networkidle0" });

    const element = await page.$("#mapColumns");
    const pngBuffer = await element.screenshot({ type: "png" });

    await browser.close();
    res.set("Content-Type", "image/png");
    res.send(pngBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).send("Screenshot failed");
  }
});

app.listen(PORT, () => console.log(`Server listening on ${PORT}`));