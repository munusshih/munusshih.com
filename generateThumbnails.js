// generateThumbnails.js
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

async function generateThumbnails() {
  // Detect if running on Vercel
  if (process.env.VERCEL) {
    console.log("Skipping thumbnails generation on Vercel.");
    process.exit(0);
  }

  console.log("Generating thumbnails...");

  // Example: List of URLs to screenshot
  const pages = [
    { url: "http://localhost:4321/", name: "index" },
    { url: "http://localhost:4321/about", name: "about" },
    { url: "http://localhost:4321/lab", name: "lab" },
    { url: "http://localhost:4321/work", name: "work" },
    { url: "http://localhost:4321/404", name: "404" },
  ];

  const thumbnailsDir = path.resolve("public/thumbnails");
  fs.mkdirSync(thumbnailsDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Set your desired viewport size
  await page.setViewportSize({ width: 1200, height: 630 });

  for (const { url, name } of pages) {
    await page.goto(url, { waitUntil: "networkidle" });

    await page.screenshot({
      path: path.join(thumbnailsDir, `${name}.jpg`),
      type: "jpeg",
      quality: 80,
      fullPage: false, // very important: do NOT screenshot the entire page
    });

    console.log(`Generated ${name}.jpg`);
  }

  await browser.close();
  console.log("Done generating!");
}

generateThumbnails();
