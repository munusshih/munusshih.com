#!/usr/bin/env node

// Verify capture tools before generation scripts can fall back to old assets.
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";
import ffmpegPath from "ffmpeg-static";
import ffprobe from "ffprobe-static";

if (process.platform === "linux") {
  const release = await fs.readFile("/etc/os-release", "utf8");
  if (/^ID=["']?amzn["']?$/m.test(release)) {
    // Vercel uses Amazon Linux, so Playwright's apt-based install-deps won't work.
    execFileSync("dnf", [
      "install", "-y", "nss", "nspr", "mesa-libgbm", "libXdamage",
      "libXfixes", "libxkbcommon", "at-spi2-atk", "alsa-lib", "cups-libs",
      "gtk3", "pango", "libXcomposite", "libXrandr",
    ], { stdio: "inherit" });
  } else {
    execFileSync(process.execPath, [
      "node_modules/playwright/cli.js", "install-deps", "chromium",
    ], { stdio: "inherit" });
  }
}

// This installs Chromium and the ffmpeg binary Playwright uses for recordVideo.
execFileSync(process.execPath, [
  "node_modules/playwright/cli.js", "install", "chromium",
], { stdio: "inherit" });

for (const executable of [ffmpegPath, ffprobe.path]) {
  if (!executable || !existsSync(executable)) {
    throw new Error("Media build requires ffmpeg-static and ffprobe-static.");
  }
  execFileSync(executable, ["-version"], { stdio: "ignore" });
}

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "build-media-check-"));
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const context = await browser.newContext({ recordVideo: { dir: tempDir } });
  const page = await context.newPage();
  await page.setContent("<h1>Media build check</h1>");
  await page.screenshot({ path: path.join(tempDir, "check.png") });
  const video = page.video();
  await context.close();
  const recording = await fs.stat(await video.path());
  if (!recording.size) throw new Error("Browser video recording produced no data.");
  console.log("Media build tools ready: screenshots, recordings, ffmpeg and ffprobe.");
} finally {
  if (browser) await browser.close();
  await fs.rm(tempDir, { recursive: true, force: true });
}
