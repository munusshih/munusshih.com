#!/usr/bin/env node

/**
 * Cache teaching media assets locally.
 *
 * Reads teaching entries via the shared content source loader,
 * inspects the img1/img2/img3 columns (and related metadata),
 * downloads or captures assets as required, and emits a manifest
 * that the site can consume at build time.
 */

import fs from "node:fs/promises";
import { createWriteStream, existsSync } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import yaml from "js-yaml";
import { teachingEntryKey } from "../src/data/teachingUtils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FORCE = process.argv.includes("--force");
const QUIET = process.argv.includes("--quiet");
const OUTPUT_DIR = path.resolve(__dirname, "../public/teaching");
const MANIFEST_PATH = path.resolve(
  __dirname,
  "../src/data/generated/teachingMedia.json",
);
const FALLBACK_PATH = path.resolve(__dirname, "../src/docs/teaching.yml");
const ENV_PATH = path.resolve(__dirname, "../.env");

const BASE_SHEET_ENV_KEYS = [
  "GOOGLE_SHEET_ID",
  "SHEET_ID",
  "CONTENT_SHEET_ID",
];
const TEACHING_URL_ENV_KEYS = [
  "TEACHING_SHEET_URL",
  "TEACHING_TAB_URL",
];

const loadEnvFile = async () => {
  try {
    const raw = await fs.readFile(ENV_PATH, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (!match) continue;
      const [, key, rest] = match;
      const value = rest.replace(/^['"]|['"]$/g, "");
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch (error) {
    if (!QUIET && error.code !== "ENOENT") {
      console.warn("Unable to read .env file", error);
    }
  }
};

const KEY_MAP = {
  title: "title",
  date: "date",
  place: "place",
  location: "place",
  type: "type",
  section: "section",
  category: "category",
  status: "status",
  note: "note",
  tags: "tags",
  tag: "tag",
  link: "link",
  url: "url",
  href: "href",
  image: "image",
  img: "image",
  "img1": "img1",
  "img 1": "img1",
  "img2": "img2",
  "img 2": "img2",
  "img3": "img3",
  "img 3": "img3",
  og: "og",
  ogimage: "ogImage",
  "og image": "ogImage",
  description: "description",
  excerpt: "excerpt",
};

const normaliseKey = (key) => key?.toString().trim().toLowerCase();

const parseList = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (trimmed.includes("\n")) {
    return trimmed
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
  }
  if (trimmed.includes(",")) {
    return trimmed
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (trimmed.includes("|")) {
    return trimmed
      .split("|")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [trimmed];
};

const assignKey = (target, key, rawValue) => {
  if (rawValue === undefined || rawValue === null) return;
  const value = typeof rawValue === "string" ? rawValue.trim() : rawValue;
  if (value === "") return;

  const normalised = normaliseKey(key);
  if (!normalised) return;

  if (["link", "url", "href"].includes(normalised)) {
    target.link = { href: String(value) };
    return;
  }

  const mapped = KEY_MAP[normalised];
  if (mapped) {
    if (mapped === "tags") {
      target.tags = parseList(value);
      return;
    }
    target[mapped] = value;
    return;
  }

  const safeKey = key
    .toString()
    .trim()
    .replace(/[^a-zA-Z0-9]+([a-zA-Z0-9])/g, (_, char) => char.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, "");

  if (safeKey) {
    const camel = safeKey[0].toLowerCase() + safeKey.slice(1);
    target[camel] = value;
  }
};

const cloneData = (data) => JSON.parse(JSON.stringify(data));

const getBaseSheetId = () => {
  for (const key of BASE_SHEET_ENV_KEYS) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
};

const resolveTeachingSheetUrl = () => {
  for (const key of TEACHING_URL_ENV_KEYS) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  const baseId = getBaseSheetId();
  if (!baseId) return undefined;
  const tabName = process.env.TEACHING_TAB_NAME?.trim() || "Teaching";
  return `https://opensheet.elk.sh/${baseId}/${encodeURIComponent(tabName)}`;
};

const loadFallbackTeaching = async () => {
  try {
    const yamlRaw = await fs.readFile(FALLBACK_PATH, "utf8");
    const parsed = yaml.load(yamlRaw);
    return Array.isArray(parsed) ? cloneData(parsed) : [];
  } catch (error) {
    if (!QUIET) {
      console.warn("Unable to load fallback teaching.yml", error);
    }
    return [];
  }
};

const normaliseRow = (row) => {
  const entry = {};
  for (const [key, value] of Object.entries(row)) {
    assignKey(entry, key, value);
  }
  return entry;
};

const loadTeachingEntries = async () => {
  const url = resolveTeachingSheetUrl();

  if (url) {
    try {
      const response = await fetch(url, { redirect: "follow" });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length) {
          return data.map(normaliseRow).filter((entry) => entry.title);
        }
      } else if (!QUIET) {
        console.warn(`Teaching sheet fetch failed: ${response.status}`);
      }
    } catch (error) {
      if (!QUIET) {
        console.warn(`Teaching sheet fetch error: ${url}`, error);
      }
    }
  }

  const fallback = await loadFallbackTeaching();
  return fallback.map(normaliseRow).filter((entry) => entry.title);
};
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

const ensureDir = async (dir) => {
  await fs.mkdir(dir, { recursive: true });
};

const slugify = (value) =>
  value
    ?.toString()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "teaching-item";

const isHttpUrl = (value) => /^https?:\/\//i.test(value);
const looksLikeVideo = (value) => /\.(mp4|webm|ogg)$/i.test(value);
const looksLikeImage = (value) => /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(value);

const parseMediaSpec = (rawValue, entry) => {
  if (!rawValue) return null;
  let remaining = String(rawValue).trim();
  if (!remaining) return null;

  const tokens = [];
  const tokenPattern = /^\[(.+?)\]\s*/;
  let match;
  while ((match = remaining.match(tokenPattern))) {
    tokens.push(match[1].trim().toLowerCase());
    remaining = remaining.slice(match[0].length).trimStart();
  }

  let caption = null;
  const captionMatch = remaining.match(/`([^`]+)`/);
  if (captionMatch) {
    caption = captionMatch[1].trim();
    remaining = (
      remaining.slice(0, captionMatch.index) +
      remaining.slice(captionMatch.index + captionMatch[0].length)
    ).trim();
  }

  const urlFallback = entry.link?.href || entry.href || "";
  const url = remaining.trim();
  const wantsDark = tokens.includes("dark");
  const wantsLight = tokens.includes("light");

  const spec = {
    dark: wantsDark,
    light: wantsLight,
    caption,
  };

  if (tokens.includes("og")) {
    spec.mode = "og";
    spec.url = url || urlFallback;
    return spec;
  }

  if (tokens.includes("video")) {
    const resolved = url || urlFallback;
  return resolved
      ? { mode: "video", url: resolved, dark: spec.dark, light: spec.light, caption }
      : null;
  }

  if (tokens.includes("img") || tokens.includes("image") || tokens.includes("screenshot")) {
    const resolved = url || urlFallback;
    return resolved
      ? { mode: "screenshot", url: resolved, dark: spec.dark, light: spec.light, caption }
      : null;
  }

  if (!tokens.length && /^\[?og\]?$/i.test(remaining)) {
    return { mode: "og", dark: spec.dark };
  }

  if (remaining.startsWith("/")) {
    return { mode: "local", path: remaining, dark: spec.dark, light: spec.light, caption };
  }

  if (remaining) {
    return { mode: "download", url: remaining, dark: spec.dark, light: spec.light, caption };
  }

  if ((tokens.includes("dark") || tokens.includes("light")) && urlFallback) {
    return {
      mode: "screenshot",
      url: urlFallback,
      dark: wantsDark,
      light: wantsLight,
      caption,
    };
  }

  return null;
};

const fetchOgImage = async (url) => {
  if (!url) return null;
  try {
    const response = await fetch(url, { redirect: "follow" });
    if (!response.ok) return null;
    const html = await response.text();

    const matches =
      html.match(
        /<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
      ) ||
      html.match(
        /<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image["']/i,
      ) ||
      html.match(
        /<meta[^>]+name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i,
      ) ||
      html.match(
        /<meta[^>]+content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i,
      );

    return matches ? matches[1] : null;
  } catch (error) {
    if (!QUIET) {
      console.warn(`Failed to fetch OG image for ${url}`, error);
    }
    return null;
  }
};

const downloadFile = async (url, destination) => {
  if (!isHttpUrl(url)) {
    throw new Error(`Unsupported URL for download: ${url}`);
  }

  const resolvedUrl = normaliseDownloadUrl(url);

  if (!FORCE && existsSync(destination)) {
    return {
      path: destination,
      contentType: "",
      url: resolvedUrl,
    };
  }

  const response = await fetch(resolvedUrl);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download ${resolvedUrl}: ${response.status}`);
  }

  await ensureDir(path.dirname(destination));
  const nodeStream =
    typeof response.body.getReader === "function"
      ? Readable.fromWeb(response.body)
      : response.body;
  const fileStream = createWriteStream(destination);
  await pipeline(nodeStream, fileStream);

  const contentType = response.headers.get("content-type") || "";

  return {
    path: destination,
    contentType,
    url: resolvedUrl,
  };
};

const normaliseDownloadUrl = (url) => {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    if (hostname.includes("drive.google.com")) {
      const fileIdMatch = parsed.pathname.match(/\/file\/d\/([^/]+)/);
      const idFromQuery = parsed.searchParams.get("id");
      const fileId = fileIdMatch ? fileIdMatch[1] : idFromQuery;

      if (fileId) {
        return `https://drive.google.com/uc?export=download&id=${fileId}`;
      }

      const ucMatch = parsed.pathname.includes("/uc")
        ? parsed.searchParams.get("id")
        : null;
      if (ucMatch) {
        return `https://drive.google.com/uc?export=download&id=${ucMatch}`;
      }
    }
  } catch (error) {
    // fall through to original url
  }

  return url;
};

let sharedBrowser = null;

const getBrowser = async () => {
  if (!sharedBrowser) {
    sharedBrowser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  return sharedBrowser;
};

const autoScroll = async (page) => {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      const distance = 400;
      const delay = 200;
      const maxScroll = document.body.scrollHeight;
      let total = 0;

      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        total += distance;
        if (total >= maxScroll) {
          clearInterval(timer);
          resolve();
        }
      }, delay);
    });
  });
};

const captureScreenshot = async (url, destination, options = {}) => {
  const { dark = false, light = false } = options;
  if (!FORCE && existsSync(destination)) return destination;
  const browser = await getBrowser();
  const page = await browser.newPage({
    viewport: { width: 1400, height: 800 },
    userAgent: USER_AGENT,
  });

  try {
    await page.emulateMedia({ colorScheme: dark ? "dark" : "light" });
    await page.goto(url, { waitUntil: "networkidle", timeout: 90_000 });
    await page.waitForTimeout(1500);
    await autoScroll(page);
    await page.waitForTimeout(800);
    await ensureDir(path.dirname(destination));
    await page.screenshot({
      path: destination,
      fullPage: true,
      type: "jpeg",
      quality: 80,
    });
  } finally {
    await page.close();
  }

  return destination;
};

const recordVideo = async (url, destination, options = {}) => {
  const { dark = false, light = true } = options;
  if (!FORCE && existsSync(destination)) return destination;
  const browser = await getBrowser();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "teaching-video-"));

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: USER_AGENT,
    colorScheme: dark ? "dark" : "light",
    recordVideo: {
      dir: tempDir,
      size: { width: 1280, height: 720 },
    },
  });

  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 90_000 });
    await page.waitForTimeout(1500);
    await autoScroll(page);
    await page.waitForTimeout(2000);
    const recordedVideo = page.video();
    await page.close();

    const videoPath = recordedVideo ? await recordedVideo.path() : null;
    if (!videoPath) {
      throw new Error(`No video recording produced for ${url}`);
    }
    await ensureDir(path.dirname(destination));
    await fs.rename(videoPath, destination);
  } finally {
    await context.close();
  }

  return destination;
};

const collectMediaSpecs = (entry) => {
  const keys = Object.keys(entry).filter((key) =>
    /^img\d+/i.test(key.replace(/\s+/g, "")),
  );

  const specs = keys
    .map((key) => parseMediaSpec(entry[key], entry))
    .filter(Boolean);

  // Include legacy `image` column if present and not already captured
  if (entry.image && !specs.length) {
    specs.push({ mode: "download", url: entry.image });
  }

  return specs;
};

const generateFileName = (slug, index, extension) =>
  `${slug}-${String(index + 1).padStart(2, "0")}.${extension}`;

const VALID_IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp", "avif"]);
const VALID_VIDEO_EXTS = new Set(["mp4", "webm", "ogg"]);

const ensureExtension = (url, fallback) => {
  const parsed = new URL(url);
  let ext = path.extname(parsed.pathname).replace(/^\./, "").toLowerCase();

  if (VALID_IMAGE_EXTS.has(ext) || VALID_VIDEO_EXTS.has(ext)) {
    return ext;
  }

  return fallback;
};

const processEntry = async (entry, options) => {
  const { force } = options;
  const slug = slugify(entry.slug ?? entry.title ?? "teaching");
  const entryDir = path.join(OUTPUT_DIR, slug);
  const specs = collectMediaSpecs(entry);

  if (!specs.length) {
    if (existsSync(entryDir)) {
      await fs.rm(entryDir, { recursive: true, force: true });
    }
    return { assets: [], slug };
  }

  if (force && existsSync(entryDir)) {
    await fs.rm(entryDir, { recursive: true, force: true });
  }

  const expectedFiles = new Set();
  const results = [];

  for (let index = 0; index < specs.length; index += 1) {
    const spec = specs[index];
    try {
      if (spec.mode === "local" && spec.path) {
        if (spec.path.startsWith("/teaching/")) {
          const localName = spec.path.split("/").pop();
          if (localName) expectedFiles.add(localName);
        }
        results.push({
          kind: looksLikeVideo(spec.path) ? "video" : "image",
          src: spec.path,
          source: "local",
          caption: spec.caption || null,
        });
        continue;
      }

      const isDark = Boolean(spec.dark);

      if (spec.mode === "og") {
        const targetUrl = spec.url || entry.link?.href || entry.href || "";
        const ogUrl =
          entry.ogImage || (targetUrl ? await fetchOgImage(targetUrl) : null);
        if (!ogUrl) continue;

        const ext = ensureExtension(ogUrl, "jpg");
        const fileName = generateFileName(slug, index, ext);
        const localPath = path.join(entryDir, fileName);
        const { path: downloadedPath, contentType } = await downloadFile(
          ogUrl,
          localPath,
        );
        let finalPath = downloadedPath;
        let finalExt = ext;

        if (contentType.startsWith("video/")) {
          if (!VALID_VIDEO_EXTS.has(ext)) {
            finalExt = "mp4";
            const renamedFile = generateFileName(slug, index, finalExt);
            const renamedPath = path.join(entryDir, renamedFile);
            await fs.rename(downloadedPath, renamedPath);
            finalPath = renamedPath;
          }
        }

        const finalName = path.basename(finalPath);
        expectedFiles.add(finalName);
        results.push({
          kind:
            contentType.startsWith("video/") || looksLikeVideo(finalPath)
              ? "video"
              : "image",
          src: `/teaching/${slug}/${finalName}`,
          source: "og",
          caption: spec.caption || null,
        });
        continue;
      }

      if (spec.mode === "video" && spec.url) {
        const videoFile = generateFileName(slug, index, "mp4");
        const videoPath = path.join(entryDir, videoFile);
        try {
          if (looksLikeVideo(spec.url) && isHttpUrl(spec.url)) {
            const { contentType } = await downloadFile(spec.url, videoPath);
            if (!contentType.startsWith("video/") && !QUIET) {
              console.warn(
                `Expected video from ${spec.url} but received content-type ${contentType}`,
              );
            }
          } else {
            await recordVideo(spec.url, videoPath, { dark: isDark });
          }
          expectedFiles.add(path.basename(videoPath));
          results.push({
            kind: "video",
            src: `/teaching/${slug}/${videoFile}`,
            source: "recorded",
            caption: spec.caption || null,
          });
          continue;
        } catch (error) {
          if (!QUIET) {
            console.warn(
              `Video capture failed for "${entry.title}" — falling back to screenshot`,
              error instanceof Error ? error.message : error,
            );
          }
          const fallbackFile = generateFileName(slug, index, "jpg");
          const fallbackPath = path.join(entryDir, fallbackFile);
          await captureScreenshot(spec.url, fallbackPath, { dark: isDark });
          expectedFiles.add(fallbackFile);
          results.push({
            kind: "image",
            src: `/teaching/${slug}/${fallbackFile}`,
            source: "video-fallback",
            caption: spec.caption || null,
          });
          continue;
        }
      }

      if (spec.mode === "screenshot" && spec.url) {
        const fileName = generateFileName(slug, index, "jpg");
        const localPath = path.join(entryDir, fileName);
        await captureScreenshot(spec.url, localPath, { dark: isDark });
        expectedFiles.add(fileName);
        results.push({
          kind: "image",
          src: `/teaching/${slug}/${fileName}`,
          source: "screenshot",
          caption: spec.caption || null,
        });
        continue;
      }

      if (spec.mode === "download" && spec.url) {
        if (!isHttpUrl(spec.url)) {
          results.push({
            kind: looksLikeVideo(spec.url) ? "video" : "image",
            src: spec.url,
            source: "reference",
            caption: spec.caption || null,
          });
          continue;
        }

        const ext = ensureExtension(
          spec.url,
          looksLikeVideo(spec.url) ? "mp4" : "jpg",
        );
        const fileName = generateFileName(slug, index, ext);
        const localPath = path.join(entryDir, fileName);
        const { path: downloadedPath, contentType } = await downloadFile(
          spec.url,
          localPath,
        );

        let finalPath = downloadedPath;
        let finalExt = ext;

        if (contentType.startsWith("video/")) {
          if (!VALID_VIDEO_EXTS.has(ext)) {
            finalExt = "mp4";
            const renamedFile = generateFileName(slug, index, finalExt);
            const renamedPath = path.join(entryDir, renamedFile);
            await fs.rename(downloadedPath, renamedPath);
            finalPath = renamedPath;
          }
        }

        const finalName = path.basename(finalPath);
        expectedFiles.add(finalName);
        results.push({
          kind:
            contentType.startsWith("video/") || looksLikeVideo(finalPath)
              ? "video"
              : "image",
          src: `/teaching/${slug}/${finalName}`,
          source: "download",
          caption: spec.caption || null,
        });
      }
    } catch (error) {
      if (!QUIET) {
        console.warn(
          `Failed to process media for "${entry.title}" (${spec.mode ?? "unknown"})`,
          error,
        );
      }
      if (force) continue;
    }
  }

  if (existsSync(entryDir)) {
    const files = await fs.readdir(entryDir);
    for (const file of files) {
      if (!expectedFiles.has(file)) {
        await fs.rm(path.join(entryDir, file), { force: true });
      }
    }
    const remaining = await fs.readdir(entryDir);
    if (!remaining.length) {
      await fs.rmdir(entryDir);
    }
  }

  return { assets: results, slug };
};

const main = async () => {
  await loadEnvFile();
  const entries = await loadTeachingEntries();
  await ensureDir(OUTPUT_DIR);
  await ensureDir(path.dirname(MANIFEST_PATH));

  let existingManifest = {};
  try {
    const raw = await fs.readFile(MANIFEST_PATH, "utf8");
    existingManifest = JSON.parse(raw);
  } catch (error) {
    if (!QUIET && error.code !== "ENOENT") {
      console.warn("Unable to read existing manifest", error);
    }
  }

  const manifest = { ...existingManifest };

  const processedKeys = new Set();

  for (const entry of entries) {
    const key = teachingEntryKey(entry);
    processedKeys.add(key);

    const { assets, slug } = await processEntry(entry, { force: FORCE });

    if (assets.length) {
      manifest[key] = assets;
      if (!QUIET) {
        console.log(`Cached ${assets.length} asset(s) for "${entry.title}"`);
      }
    } else if (manifest[key]) {
      delete manifest[key];
      if (!QUIET) {
        console.log(`Removed cached assets for "${entry.title}"`);
      }
      const slugPath = path.join(OUTPUT_DIR, slug);
      if (existsSync(slugPath)) {
        await fs.rm(slugPath, { recursive: true, force: true });
      }
    }
  }

  const staleSlugs = new Set();

  for (const key of Object.keys(manifest)) {
    if (!processedKeys.has(key)) {
      const assets = manifest[key] ?? [];
      for (const asset of assets) {
        if (asset?.src?.startsWith("/teaching/")) {
          const slug = asset.src.split("/")[2];
          if (slug) staleSlugs.add(slug);
        }
      }
      delete manifest[key];
    }
  }

  for (const slug of staleSlugs) {
    const slugPath = path.join(OUTPUT_DIR, slug);
    if (existsSync(slugPath)) {
      await fs.rm(slugPath, { recursive: true, force: true });
    }
  }

  const referencedSlugs = new Set();
  for (const assets of Object.values(manifest)) {
    for (const asset of assets) {
      if (asset?.src?.startsWith("/teaching/")) {
        const slug = asset.src.split("/")[2];
        if (slug) referencedSlugs.add(slug);
      }
    }
  }

  const existingEntries = await fs.readdir(OUTPUT_DIR);
  for (const entry of existingEntries) {
    const fullPath = path.join(OUTPUT_DIR, entry);
    try {
      const stat = await fs.stat(fullPath);
      if (!stat.isDirectory()) continue;
      if (!referencedSlugs.has(entry)) {
        await fs.rm(fullPath, { recursive: true, force: true });
      }
    } catch (error) {
      if (!QUIET) {
        console.warn(`Failed to inspect cache entry ${entry}`, error);
      }
    }
  }

  await fs.writeFile(
    MANIFEST_PATH,
    JSON.stringify(manifest, null, 2),
    "utf8",
  );

  if (sharedBrowser) {
    await sharedBrowser.close();
  }

  if (!QUIET) {
    console.log(`Manifest written to ${path.relative(process.cwd(), MANIFEST_PATH)}`);
  }
};

main().catch(async (error) => {
  if (sharedBrowser) {
    await sharedBrowser.close();
  }
  console.error(error);
  process.exitCode = 1;
});
