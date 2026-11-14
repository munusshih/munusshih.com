import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import yaml from "js-yaml";
import ffmpeg from "ffmpeg-static";
import { chromium } from "playwright";
import { parseMediaSpec } from "./cacheTeachingMedia.js";
import { recordSiteScroll } from "./recordSiteScroll.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const contentDir = path.join(root, "src/content/research");
const exec = promisify(execFile);
const force = process.argv.includes("--force");
const requested = process.argv.slice(2).filter((arg) => arg !== "--force");

const browser = await chromium.launch();
try {
  for (const file of await fs.readdir(contentDir)) {
    if (!file.endsWith(".yml")) continue;
    const id = path.basename(file, ".yml");
    if (requested.length && !requested.includes(id)) continue;
    const entry = yaml.load(
      await fs.readFile(path.join(contentDir, file), "utf8"),
    );
    if (!entry.og) continue;
    const spec = parseMediaSpec(entry.og, { href: entry.link });
    if (spec?.mode !== "video") continue;

    const assetDir = path.join(root, "src/assets/research", id);
    const posterDir = path.join(root, "src/assets/posters/research", id);
    const destination = path.join(assetDir, "site-scroll.mp4");
    const poster = path.join(posterDir, "site-scroll.jpg");
    if (!force) {
      const cached = await Promise.allSettled([
        fs.access(destination),
        fs.access(poster),
      ]);
      if (cached.every((item) => item.status === "fulfilled")) continue;
    }

    const temp = await fs.mkdtemp(path.join(os.tmpdir(), "research-video-"));
    try {
      const posterPath = path.join(temp, "site-scroll.jpg");
      const recording = await recordSiteScroll(browser, spec.url, temp, {
        colorScheme: spec.dark ? "dark" : "light",
        waitUntil: "domcontentloaded",
        timeout: 30_000,
        trimLoading: true,
        prepare: async (page, response) => {
          if (response && !response.ok())
            throw new Error(`HTTP ${response.status()}`);
          await page.waitForFunction(
            () =>
              document.body?.innerText.trim().length > 100 &&
              document.documentElement.scrollHeight > innerHeight + 40,
            undefined,
            { timeout: 20_000 },
          );
          if (
            /just a moment|access denied|verify you are human|forbidden/i.test(
              await page.title(),
            )
          ) {
            throw new Error("The page returned an access screen");
          }
          await page
            .waitForLoadState("load", { timeout: 5_000 })
            .catch(() => {});
          await page.evaluate(async () => {
            const visibleImages = Array.from(document.images).filter((img) => {
              const box = img.getBoundingClientRect();
              return box.width > 0 && box.top < innerHeight && box.bottom > 0;
            });
            await Promise.race([
              Promise.allSettled([
                document.fonts.ready,
                ...visibleImages.map((img) => img.decode()),
              ]),
              new Promise((resolve) => setTimeout(resolve, 3_000)),
            ]);
          });
        },
      });
      const output = path.join(temp, "site-scroll.mp4");
      await exec(ffmpeg, [
        "-y",
        "-ss",
        recording.startTime.toFixed(3),
        "-i",
        recording.path,
        "-vf",
        "scale=960:540,format=yuv420p",
        "-c:v",
        "libx264",
        "-crf",
        "27",
        "-movflags",
        "+faststart",
        "-an",
        output,
      ]);
      await exec(ffmpeg, [
        "-y",
        "-i",
        output,
        "-frames:v",
        "1",
        "-q:v",
        "3",
        posterPath,
      ]);
      await fs.mkdir(assetDir, { recursive: true });
      await fs.mkdir(posterDir, { recursive: true });
      await fs.copyFile(output, destination);
      await fs.copyFile(posterPath, poster);
      console.log(`Recorded ${id}`);
    } catch (error) {
      console.warn(`Could not record ${id}: ${error.message}`);
      process.exitCode = 1;
    } finally {
      await fs.rm(temp, { recursive: true, force: true });
    }
  }
} finally {
  await browser.close();
}
