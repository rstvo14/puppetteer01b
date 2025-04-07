import puppeteer from "puppeteer";
import fs from "fs";

(async () => {
  const browser = await puppeteer.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  const page = await browser.newPage();
  await page.goto("http://localhost:3000", { waitUntil: "networkidle0" });
  const element = await page.$("#mapColumns");
  await element.screenshot({ path: "mapColumns.png" });
  await browser.close();
  console.log("✔  Saved mapColumns.png");
})();