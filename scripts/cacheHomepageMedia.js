#!/usr/bin/env node

import fs from "node:fs/promises";
import { createWriteStream, existsSync } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import yaml from "js-yaml";
import { chromium } from "playwright";
import {
  homepageEntryKey,
  isHomepageEntryEnabled,
  parseMediaList,
  parseVisibilityFlag,
} from "../src/data/homepageUtils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FORCE = process.argv.includes("--force");
const QUIET = process.argv.includes("--quiet");
const HOMEPAGE_YAML = path.resolve(__dirname, "../src/docs/homepage.yml");
const ASSET_ROOT = path.resolve(__dirname, "../src/assets/homepage");
const LINK_ASSET_ROOT = path.join(ASSET_ROOT, "links");
const INSTAGRAM_ASSET_ROOT = path.join(ASSET_ROOT, "instagram");
const MANIFEST_PATH = path.resolve(
  __dirname,
  "../src/data/generated/homepageMedia.json",
);
const SRC_ASSET_ROOT = path.resolve(__dirname, "../src/assets");

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

const VALID_IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp", "avif"]);
const VALID_VIDEO_EXTS = new Set(["mp4", "webm", "ogg", "mov", "m4v"]);

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
    .toLowerCase() || "item";

const isHttpUrl = (value) => /^https?:\/\//i.test(String(value ?? ""));
const looksLikeVideo = (value) => /\.(mp4|webm|ogg|mov|m4v)(?:$|[?#])/i.test(value);
const looksLikeImage = (value) =>
  /\.(jpe?g|png|gif|webp|avif|svg)(?:$|[?#])/i.test(value);

const toAssetUrl = (absolutePath) => {
  const relative = path
    .relative(SRC_ASSET_ROOT, absolutePath)
    .split(path.sep)
    .join("/");
  return `/assets/${relative}`;
};

const safeFileName = (fileName) =>
  fileName
    .replace(/[^\w.-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const escapeRegExp = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const decodeHtmlEntities = (value) =>
  String(value)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

const decodeInstagramEscapes = (value) =>
  String(value)
    .replace(/\\u0026/g, "&")
    .replace(/\\u003d/g, "=")
    .replace(/\\\//g, "/")
    .replace(/\\"/g, '"');

const makeEntryDirName = (entry, prefix) => {
  const key = homepageEntryKey(entry) || JSON.stringify(entry);
  const hash = createHash("sha1").update(key).digest("hex").slice(0, 8);
  const titleSlug = slugify(entry.title || entry.linkContent || entry.type || "card")
    .slice(0, 48);
  return `${prefix}-${titleSlug}-${hash}`;
};

const getLinkHref = (entry) =>
  entry?.href ||
  entry?.link?.href ||
  entry?.url ||
  entry?.source ||
  entry?.instagramUrl ||
  "";

const getFirstDefinedString = (values) => {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
};

const inferDarkMode = (entry) => {
  const fromBoolean = [entry?.dark, entry?.isDark].find(
    (value) => value !== undefined && value !== null,
  );
  if (fromBoolean !== undefined) {
    return parseVisibilityFlag(fromBoolean);
  }

  const scheme = getFirstDefinedString([
    entry?.colorScheme,
    entry?.theme,
    entry?.appearance,
  ]).toLowerCase();

  return scheme.includes("dark");
};

const inferPreviewMode = (entry) => {
  const raw = getFirstDefinedString([
    entry?.previewMode,
    entry?.captureMode,
    entry?.preview,
    entry?.mediaMode,
    entry?.mode,
  ]).toLowerCase();

  if (!raw) return "auto";
  if (raw.includes("record") || raw.includes("video") || raw.includes("webm")) {
    return "record";
  }
  if (
    raw.includes("screenshot") ||
    raw.includes("capture") ||
    raw.includes("screen")
  ) {
    return "screenshot";
  }
  if (raw.includes("og") || raw.includes("open graph") || raw.includes("opengraph")) {
    return "og";
  }
  return "auto";
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
    }
  } catch (_error) {
    // keep original URL
  }

  return url;
};

const extensionFromContentType = (contentType, fallback) => {
  const normalized = String(contentType ?? "").toLowerCase();
  if (!normalized) return fallback;

  if (normalized.includes("video/webm")) return "webm";
  if (normalized.includes("video/mp4")) return "mp4";
  if (normalized.includes("video/ogg")) return "ogg";
  if (normalized.includes("video/")) return "mp4";

  if (normalized.includes("image/png")) return "png";
  if (normalized.includes("image/webp")) return "webp";
  if (normalized.includes("image/avif")) return "avif";
  if (normalized.includes("image/gif")) return "gif";
  if (normalized.includes("image/svg")) return "svg";
  if (normalized.includes("image/jpeg") || normalized.includes("image/jpg")) {
    return "jpg";
  }
  if (normalized.includes("image/")) return "jpg";

  return fallback;
};

const ensureExtension = (url, fallback) => {
  try {
    const parsed = new URL(url);
    const ext = path.extname(parsed.pathname).replace(/^\./, "").toLowerCase();
    if (VALID_IMAGE_EXTS.has(ext) || VALID_VIDEO_EXTS.has(ext)) {
      return ext;
    }
  } catch (_error) {
    // fallback below
  }
  return fallback;
};

const downloadFile = async (url, destination) => {
  if (!isHttpUrl(url)) {
    throw new Error(`Unsupported URL for download: ${url}`);
  }

  const resolvedUrl = normaliseDownloadUrl(url);

  if (!FORCE && existsSync(destination)) {
    return { path: destination, contentType: "", url: resolvedUrl };
  }

  const response = await fetch(resolvedUrl, {
    headers: {
      "user-agent": USER_AGENT,
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    },
    redirect: "follow",
  });

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

  return {
    path: destination,
    contentType: response.headers.get("content-type") || "",
    url: resolvedUrl,
  };
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

const closeBrowser = async () => {
  if (sharedBrowser) {
    await sharedBrowser.close();
    sharedBrowser = null;
  }
};

const autoScroll = async (page) => {
  await page.evaluate(async () => {
    window.scrollTo(0, 0);
    await new Promise((resolve) => {
      const distance = 380;
      const delay = 180;
      const maxIterations = 30;
      let iterations = 0;

      const timer = setInterval(() => {
        const maxScroll =
          Math.max(
            document.body.scrollHeight,
            document.documentElement.scrollHeight,
          ) - window.innerHeight;

        window.scrollBy(0, distance);
        iterations += 1;

        if (window.scrollY >= maxScroll || iterations >= maxIterations) {
          clearInterval(timer);
          resolve();
        }
      }, delay);
    });
  });
};

const captureScreenshot = async (url, destination, options = {}) => {
  const { dark = false } = options;
  if (!FORCE && existsSync(destination)) return destination;

  const browser = await getBrowser();
  const page = await browser.newPage({
    viewport: { width: 1400, height: 900 },
    userAgent: USER_AGENT,
  });

  try {
    await page.emulateMedia({ colorScheme: dark ? "dark" : "light" });
    await page.goto(url, { waitUntil: "networkidle", timeout: 90_000 });
    await page.waitForTimeout(1200);
    await autoScroll(page);
    await page.waitForTimeout(800);
    await ensureDir(path.dirname(destination));
    await page.screenshot({
      path: destination,
      type: "jpeg",
      quality: 82,
      fullPage: true,
    });
  } finally {
    await page.close();
  }

  return destination;
};

const recordVideo = async (url, destination, options = {}) => {
  const { dark = false } = options;
  if (!FORCE && existsSync(destination)) return destination;

  const browser = await getBrowser();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "homepage-video-"));

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
    await page.waitForTimeout(1700);
    const recordedVideo = page.video();
    await page.close();

    const videoPath = recordedVideo ? await recordedVideo.path() : null;
    if (!videoPath) {
      throw new Error(`No video file recorded for ${url}`);
    }

    await ensureDir(path.dirname(destination));
    await fs.rename(videoPath, destination);
  } finally {
    await context.close();
    await fs.rm(tempDir, { recursive: true, force: true });
  }

  return destination;
};

const extractMeta = (html, attr, value) => {
  const escapedAttr = escapeRegExp(attr);
  const escapedValue = escapeRegExp(value);
  const patterns = [
    new RegExp(
      `<meta[^>]+${escapedAttr}=["']${escapedValue}["'][^>]*content=["']([^"']+)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]*${escapedAttr}=["']${escapedValue}["']`,
      "i",
    ),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return decodeHtmlEntities(match[1].trim());
    }
  }
  return null;
};

const toAbsoluteUrl = (candidate, baseUrl) => {
  if (!candidate) return null;
  try {
    return new URL(candidate, baseUrl).toString();
  } catch (_error) {
    return null;
  }
};

const fetchOpenGraphData = async (url) => {
  if (!url) return null;

  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
    });

    if (!response.ok) return null;

    const html = await response.text();
    const finalUrl = response.url || url;
    const ogImage =
      extractMeta(html, "property", "og:image") ||
      extractMeta(html, "name", "twitter:image");
    const ogVideo =
      extractMeta(html, "property", "og:video") ||
      extractMeta(html, "property", "og:video:url") ||
      extractMeta(html, "name", "twitter:player:stream");

    return {
      imageUrl: toAbsoluteUrl(ogImage, finalUrl),
      videoUrl: toAbsoluteUrl(ogVideo, finalUrl),
    };
  } catch (error) {
    if (!QUIET) {
      console.warn(`homepage media: failed OG fetch for ${url}`, error);
    }
    return null;
  }
};

const parseLimit = (value, fallback = 8) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  const safe = Math.floor(numeric);
  return Math.min(Math.max(safe, 1), 20);
};

const resolveInstagramUsername = (entry) => {
  const direct = getFirstDefinedString([
    entry?.instagramUsername,
    entry?.username,
    entry?.handle,
  ]);
  if (direct) {
    return direct.replace(/^@/, "").trim();
  }

  const href = getLinkHref(entry);
  if (!href) return "";

  try {
    const parsed = new URL(href);
    if (!parsed.hostname.toLowerCase().includes("instagram.com")) return "";
    const firstSegment = parsed.pathname.split("/").filter(Boolean)[0];
    if (!firstSegment) return "";
    return firstSegment.replace(/^@/, "").trim();
  } catch (_error) {
    return "";
  }
};

const extractInstagramNodeCaption = (node) => {
  const edges = node?.edge_media_to_caption?.edges;
  if (!Array.isArray(edges) || !edges.length) return "";
  const first = edges[0]?.node?.text;
  return typeof first === "string" ? first.trim() : "";
};

const buildInstagramPermalink = (shortcode) =>
  shortcode ? `https://www.instagram.com/p/${shortcode}/` : "";

const extractInstagramShortcode = (url) => {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.toLowerCase().includes("instagram.com")) return "";
    const segments = parsed.pathname.split("/").filter(Boolean);
    const markerIndex = segments.findIndex((segment) =>
      ["p", "reel", "tv"].includes(segment.toLowerCase()),
    );
    if (markerIndex < 0) return "";
    return segments[markerIndex + 1] || "";
  } catch (_error) {
    return "";
  }
};

const flattenInstagramNodes = (user) => {
  const edges = user?.edge_owner_to_timeline_media?.edges;
  if (!Array.isArray(edges)) return [];

  const items = [];

  for (const edge of edges) {
    const node = edge?.node;
    if (!node) continue;

    const parentShortcode = node.shortcode || "";
    const parentCaption = extractInstagramNodeCaption(node);

    const children =
      node.__typename === "GraphSidecar" &&
      Array.isArray(node?.edge_sidecar_to_children?.edges)
        ? node.edge_sidecar_to_children.edges.map((child) => child?.node).filter(Boolean)
        : [node];

    for (const child of children) {
      const shortcode = child.shortcode || parentShortcode;
      items.push({
        shortcode,
        permalink: buildInstagramPermalink(shortcode),
        caption: parentCaption || "",
        isVideo: Boolean(child.is_video),
        videoUrl:
          child.video_url ||
          child.video_versions?.[0]?.url ||
          child.video_resources?.[0]?.src ||
          "",
        imageUrl:
          child.display_url ||
          child.thumbnail_src ||
          child.display_resources?.at?.(-1)?.src ||
          "",
      });
    }
  }

  return items;
};

const fetchInstagramPostMedia = async (shortcode) => {
  if (!shortcode) return { videoUrl: "", imageUrl: "" };
  const url = `https://www.instagram.com/p/${shortcode}/embed/captioned/`;
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
    });
    if (!response.ok) return { videoUrl: "", imageUrl: "" };
    const html = await response.text();

    const videoMatch = html.match(/"video_url":"([^"]+)"/i);
    const imageMatch =
      html.match(/"display_url":"([^"]+)"/i) ||
      html.match(/"thumbnail_url":"([^"]+)"/i);

    return {
      videoUrl: videoMatch ? decodeInstagramEscapes(videoMatch[1]) : "",
      imageUrl: imageMatch ? decodeInstagramEscapes(imageMatch[1]) : "",
    };
  } catch (_error) {
    return { videoUrl: "", imageUrl: "" };
  }
};

const fetchInstagramProfile = async (username) => {
  if (!username) return null;

  const apiUrl = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`;
  const legacyUrl = `https://www.instagram.com/${encodeURIComponent(username)}/?__a=1&__d=dis`;

  const requestHeaders = {
    "user-agent": USER_AGENT,
    accept: "*/*",
    "x-ig-app-id": "936619743392459",
    "x-requested-with": "XMLHttpRequest",
    referer: `https://www.instagram.com/${username}/`,
  };

  const candidates = [apiUrl, legacyUrl];

  for (const url of candidates) {
    try {
      const response = await fetch(url, {
        headers: requestHeaders,
        redirect: "follow",
      });
      if (!response.ok) continue;
      const data = await response.json();
      const user = data?.data?.user || data?.graphql?.user || null;
      if (user) return user;
    } catch (_error) {
      // try next endpoint
    }
  }

  return null;
};

const removeUnexpectedFiles = async (directory, expectedFiles) => {
  if (!existsSync(directory)) return;
  const files = await fs.readdir(directory);
  for (const file of files) {
    if (!expectedFiles.has(file)) {
      await fs.rm(path.join(directory, file), { force: true, recursive: true });
    }
  }
  const remaining = await fs.readdir(directory);
  if (!remaining.length) {
    await fs.rm(directory, { recursive: true, force: true });
  }
};

const finalizeDownloadedAsset = async (options) => {
  const { downloadedPath, desiredExt, contentType, destinationDir, baseName } = options;
  const inferredExt = extensionFromContentType(contentType, desiredExt);
  const currentExt = path.extname(downloadedPath).replace(/^\./, "").toLowerCase();
  const finalExt = inferredExt || currentExt || desiredExt;
  const cleanBase = safeFileName(baseName);
  const finalName = `${cleanBase}.${finalExt}`;
  const finalPath = path.join(destinationDir, finalName);

  if (path.basename(downloadedPath) !== finalName) {
    if (existsSync(finalPath)) {
      await fs.rm(finalPath, { force: true });
    }
    await fs.rename(downloadedPath, finalPath);
  }

  return finalPath;
};

const fallbackAssetsFromTarget = (entry) => {
  const items = parseMediaList(entry?.targetName);
  return items
    .filter((src) =>
      /\.(mp4|webm|ogg|mov|m4v|jpe?g|png|gif|webp|avif|svg)(?:$|[?#])/i.test(src),
    )
    .map((src, index) => ({
      kind: looksLikeVideo(src) ? "video" : "image",
      src,
      source: "targetName",
      order: index + 1,
    }));
};

const parseTargetSpec = (rawValue) => {
  if (rawValue === undefined || rawValue === null) return null;
  let remaining = String(rawValue).trim();
  if (!remaining) return null;

  const tokens = [];
  const tokenPattern = /^\[(.+?)\]\s*/;
  let match;

  while ((match = remaining.match(tokenPattern))) {
    tokens.push(match[1].trim().toLowerCase());
    remaining = remaining.slice(match[0].length).trimStart();
  }

  const mode = tokens.includes("video") ||
    tokens.includes("record") ||
    tokens.includes("webm")
    ? "record"
    : tokens.includes("screenshot") ||
        tokens.includes("image") ||
        tokens.includes("img") ||
        tokens.includes("screen")
      ? "screenshot"
      : tokens.includes("og") ||
          tokens.includes("open graph") ||
          tokens.includes("opengraph")
        ? "og"
        : "";

  return {
    tokens,
    mode,
    target: remaining.trim(),
    dark: tokens.includes("dark"),
    light: tokens.includes("light"),
  };
};

const processLinkEntry = async (entry) => {
  const href = getLinkHref(entry);
  const previewMode = inferPreviewMode(entry);
  let dark = inferDarkMode(entry);
  const dirName = makeEntryDirName(entry, "link");
  const entryDir = path.join(LINK_ASSET_ROOT, dirName);
  const expectedFiles = new Set();
  const assets = [];
  let effectiveHref = href;
  let modeOverride = "";

  await ensureDir(entryDir);

  const addLocalAsset = (localPath, kind, source) => {
    const fileName = path.basename(localPath);
    expectedFiles.add(fileName);
    assets.push({
      kind,
      src: toAssetUrl(localPath),
      source,
    });
  };

  const directTargets = parseMediaList(entry?.targetName);
  if (directTargets.length) {
    const parsedSpec = parseTargetSpec(directTargets[0]);
    const first = parsedSpec?.target || String(directTargets[0] ?? "").trim();

    if (parsedSpec?.mode) {
      modeOverride = parsedSpec.mode;
    }
    if (parsedSpec?.dark) dark = true;
    if (parsedSpec?.light) dark = false;

    if (!first) {
      await removeUnexpectedFiles(entryDir, expectedFiles);
      return { assets, dirName };
    }

    if (!isHttpUrl(first)) {
      if (looksLikeImage(first) || looksLikeVideo(first)) {
        assets.push({
          kind: looksLikeVideo(first) ? "video" : "image",
          src: first,
          source: "targetName",
        });
      }
      await removeUnexpectedFiles(entryDir, expectedFiles);
      return { assets, dirName };
    }

    if (looksLikeImage(first) || looksLikeVideo(first)) {
      try {
        const desiredExt = ensureExtension(
          first,
          looksLikeVideo(first) ? "mp4" : "jpg",
        );
        const seed = path.join(entryDir, `preview.${desiredExt}`);
        const { path: downloadedPath, contentType } = await downloadFile(first, seed);
        const finalPath = await finalizeDownloadedAsset({
          downloadedPath,
          desiredExt,
          contentType,
          destinationDir: entryDir,
          baseName: "preview",
        });
        addLocalAsset(
          finalPath,
          /\.(mp4|webm|ogg|mov|m4v)$/i.test(finalPath) ? "video" : "image",
          "targetName",
        );
        await removeUnexpectedFiles(entryDir, expectedFiles);
        return { assets, dirName };
      } catch (error) {
        if (!QUIET) {
          console.warn(`Link target download failed for "${entry.title}"`, error);
        }
      }
    } else if (!effectiveHref) {
      effectiveHref = first;
    }
  }

  const effectiveMode = modeOverride || previewMode;

  if (!effectiveHref) {
    const fallbackAssets = fallbackAssetsFromTarget(entry);
    await removeUnexpectedFiles(entryDir, expectedFiles);
    return { assets: fallbackAssets, dirName };
  }

  if (effectiveMode === "record") {
    try {
      if (looksLikeVideo(effectiveHref)) {
        const ext = ensureExtension(effectiveHref, "webm");
        const seed = path.join(entryDir, `preview.${ext}`);
        const { path: downloadedPath, contentType } = await downloadFile(
          effectiveHref,
          seed,
        );
        const finalPath = await finalizeDownloadedAsset({
          downloadedPath,
          desiredExt: ext,
          contentType,
          destinationDir: entryDir,
          baseName: "preview",
        });
        addLocalAsset(finalPath, "video", "download");
      } else {
        const videoPath = path.join(entryDir, "preview.webm");
        await recordVideo(effectiveHref, videoPath, { dark });
        addLocalAsset(videoPath, "video", "recorded");
      }
    } catch (error) {
      if (!QUIET) {
        console.warn(
          `Video capture failed for "${entry.title}" (${effectiveHref}), falling back to screenshot`,
          error,
        );
      }
      try {
        const screenshotPath = path.join(entryDir, "preview.jpg");
        await captureScreenshot(effectiveHref, screenshotPath, { dark });
        addLocalAsset(screenshotPath, "image", "record-fallback");
      } catch (fallbackError) {
        if (!QUIET) {
          console.warn(
            `Screenshot fallback failed for "${entry.title}" (${effectiveHref})`,
            fallbackError,
          );
        }
      }
    }

    await removeUnexpectedFiles(entryDir, expectedFiles);
    return { assets, dirName };
  }

  if (effectiveMode === "screenshot") {
    try {
      const screenshotPath = path.join(entryDir, "preview.jpg");
      await captureScreenshot(effectiveHref, screenshotPath, { dark });
      addLocalAsset(screenshotPath, "image", "screenshot");
    } catch (error) {
      if (!QUIET) {
        console.warn(
          `Screenshot capture failed for "${entry.title}" (${effectiveHref})`,
          error,
        );
      }
    }
    await removeUnexpectedFiles(entryDir, expectedFiles);
    return { assets, dirName };
  }

  const ogData = await fetchOpenGraphData(effectiveHref);
  const ogCandidate = ogData?.videoUrl || ogData?.imageUrl;

  if (ogCandidate) {
    try {
      const desiredExt = ensureExtension(
        ogCandidate,
        ogData?.videoUrl ? "mp4" : "jpg",
      );
      const seed = path.join(entryDir, `preview.${desiredExt}`);
      const { path: downloadedPath, contentType } = await downloadFile(
        ogCandidate,
        seed,
      );
      const finalPath = await finalizeDownloadedAsset({
        downloadedPath,
        desiredExt,
        contentType,
        destinationDir: entryDir,
        baseName: "preview",
      });
      addLocalAsset(
        finalPath,
        /\.(mp4|webm|ogg|mov|m4v)$/i.test(finalPath) ? "video" : "image",
        "og",
      );
      await removeUnexpectedFiles(entryDir, expectedFiles);
      return { assets, dirName };
    } catch (error) {
      if (!QUIET) {
        console.warn(
          `OG download failed for "${entry.title}" (${effectiveHref})`,
          error,
        );
      }
    }
  }

  if (effectiveMode !== "og") {
    try {
      const screenshotPath = path.join(entryDir, "preview.jpg");
      await captureScreenshot(effectiveHref, screenshotPath, { dark });
      addLocalAsset(screenshotPath, "image", "screenshot-fallback");
    } catch (error) {
      if (!QUIET) {
        console.warn(
          `Automatic screenshot fallback failed for "${entry.title}" (${effectiveHref})`,
          error,
        );
      }
    }
    await removeUnexpectedFiles(entryDir, expectedFiles);
    return { assets, dirName };
  }

  await removeUnexpectedFiles(entryDir, expectedFiles);
  return { assets, dirName };
};

const processInstagramEntry = async (entry) => {
  const dirName = makeEntryDirName(entry, "instagram");
  const entryDir = path.join(INSTAGRAM_ASSET_ROOT, dirName);
  const expectedFiles = new Set();
  const assets = [];
  const entryHref = getLinkHref(entry);

  await ensureDir(entryDir);

  const limit = parseLimit(
    entry?.limit ?? entry?.count ?? entry?.itemCount ?? entry?.items,
    8,
  );
  const username = resolveInstagramUsername(entry);

  if (!username) {
    const fallbackAssets = fallbackAssetsFromTarget(entry);
    await removeUnexpectedFiles(entryDir, expectedFiles);
    return { assets: fallbackAssets, dirName };
  }

  const profile = await fetchInstagramProfile(username);
  const nodes = flattenInstagramNodes(profile).slice(0, limit * 2);

  for (let index = 0; index < nodes.length && assets.length < limit; index += 1) {
    const node = nodes[index];
    let kind = node.videoUrl ? "video" : "image";
    let sourceUrl = node.videoUrl || node.imageUrl;

    if (node.isVideo && !node.videoUrl && node.shortcode) {
      const postMedia = await fetchInstagramPostMedia(node.shortcode);
      if (postMedia.videoUrl) {
        sourceUrl = postMedia.videoUrl;
        kind = "video";
      } else if (postMedia.imageUrl) {
        sourceUrl = postMedia.imageUrl;
        kind = "image";
      }
    }

    if (!sourceUrl || !isHttpUrl(sourceUrl)) continue;

    try {
      const desiredExt = ensureExtension(
        sourceUrl,
        kind === "video" ? "mp4" : "jpg",
      );
      const baseName = `${safeFileName(username)}-${String(assets.length + 1).padStart(2, "0")}`;
      const seed = path.join(entryDir, `${baseName}.${desiredExt}`);
      const { path: downloadedPath, contentType } = await downloadFile(
        sourceUrl,
        seed,
      );
      const finalPath = await finalizeDownloadedAsset({
        downloadedPath,
        desiredExt,
        contentType,
        destinationDir: entryDir,
        baseName,
      });

      const finalFileName = path.basename(finalPath);
      expectedFiles.add(finalFileName);
      assets.push({
        kind:
          /\.(mp4|webm|ogg|mov|m4v)$/i.test(finalPath) || contentType.startsWith("video/")
            ? "video"
            : "image",
        src: toAssetUrl(finalPath),
        source: "instagram",
        caption: node.caption || "",
        href: node.permalink || `https://www.instagram.com/${username}/`,
      });
    } catch (error) {
      if (!QUIET) {
        console.warn(
          `Instagram media download failed for "${entry.title}" (${sourceUrl})`,
          error,
        );
      }
    }
  }

  if (!assets.length) {
    const shortcodeFromHref = extractInstagramShortcode(entryHref);
    if (shortcodeFromHref) {
      const postMedia = await fetchInstagramPostMedia(shortcodeFromHref);
      const candidate = postMedia.videoUrl || postMedia.imageUrl;
      if (candidate && isHttpUrl(candidate)) {
        try {
          const desiredExt = ensureExtension(
            candidate,
            postMedia.videoUrl ? "mp4" : "jpg",
          );
          const seed = path.join(entryDir, `post-01.${desiredExt}`);
          const { path: downloadedPath, contentType } = await downloadFile(
            candidate,
            seed,
          );
          const finalPath = await finalizeDownloadedAsset({
            downloadedPath,
            desiredExt,
            contentType,
            destinationDir: entryDir,
            baseName: "post-01",
          });

          const finalFileName = path.basename(finalPath);
          expectedFiles.add(finalFileName);
          assets.push({
            kind:
              /\.(mp4|webm|ogg|mov|m4v)$/i.test(finalPath) ||
              contentType.startsWith("video/")
                ? "video"
                : "image",
            src: toAssetUrl(finalPath),
            source: "instagram-post",
            caption: "",
            href: entryHref || buildInstagramPermalink(shortcodeFromHref),
          });
        } catch (error) {
          if (!QUIET) {
            console.warn(
              `Instagram post media download failed for "${entry.title}" (${candidate})`,
              error,
            );
          }
        }
      }
    }
  }

  if (!assets.length) {
    const fallbackAssets = fallbackAssetsFromTarget(entry);
    await removeUnexpectedFiles(entryDir, expectedFiles);
    return { assets: fallbackAssets, dirName };
  }

  await removeUnexpectedFiles(entryDir, expectedFiles);
  return { assets, dirName };
};

const pruneUnusedDirs = async (baseDir, usedDirs) => {
  await ensureDir(baseDir);
  const entries = await fs.readdir(baseDir);
  for (const entry of entries) {
    const fullPath = path.join(baseDir, entry);
    const stat = await fs.stat(fullPath);
    if (!stat.isDirectory()) continue;
    if (!usedDirs.has(entry)) {
      await fs.rm(fullPath, { recursive: true, force: true });
    }
  }
};

const parseOrder = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : Number.MAX_SAFE_INTEGER;
};

const normaliseType = (entry) =>
  String(entry?.type ?? entry?.card ?? entry?.component ?? "")
    .trim()
    .toLowerCase();

const loadHomepageEntries = async () => {
  const raw = await fs.readFile(HOMEPAGE_YAML, "utf8");
  const parsed = yaml.load(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((entry) => entry && typeof entry === "object")
    .sort((a, b) => parseOrder(a?.order) - parseOrder(b?.order));
};

const main = async () => {
  await ensureDir(LINK_ASSET_ROOT);
  await ensureDir(INSTAGRAM_ASSET_ROOT);
  await ensureDir(path.dirname(MANIFEST_PATH));

  const homepageEntries = await loadHomepageEntries();
  const candidateEntries = homepageEntries.filter((entry) => {
    const type = normaliseType(entry);
    if (!isHomepageEntryEnabled(entry)) return false;
    return (
      type === "linkcard" ||
      type === "link" ||
      type === "instagramcard" ||
      type === "instagram"
    );
  });

  const manifest = {};
  const usedLinkDirs = new Set();
  const usedInstagramDirs = new Set();

  for (const entry of candidateEntries) {
    const key = homepageEntryKey(entry);
    if (!key) continue;
    const type = normaliseType(entry);

    if (type === "linkcard" || type === "link") {
      const { assets, dirName } = await processLinkEntry(entry);
      usedLinkDirs.add(dirName);
      if (assets.length) {
        manifest[key] = {
          type: "link",
          assets,
          href: getLinkHref(entry) || "",
        };
        if (!QUIET) {
          console.log(`Cached link preview (${assets.length}) for "${entry.title || key}"`);
        }
      }
      continue;
    }

    if (type === "instagramcard" || type === "instagram") {
      const { assets, dirName } = await processInstagramEntry(entry);
      usedInstagramDirs.add(dirName);
      if (assets.length) {
        manifest[key] = {
          type: "instagram",
          assets,
          href: getLinkHref(entry) || "",
        };
        if (!QUIET) {
          console.log(`Cached instagram media (${assets.length}) for "${entry.title || key}"`);
        }
      }
    }
  }

  await pruneUnusedDirs(LINK_ASSET_ROOT, usedLinkDirs);
  await pruneUnusedDirs(INSTAGRAM_ASSET_ROOT, usedInstagramDirs);

  await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await closeBrowser();
};

main().catch(async (error) => {
  await closeBrowser();
  console.error(error);
  process.exitCode = 1;
});
