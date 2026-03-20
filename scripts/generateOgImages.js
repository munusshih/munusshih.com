#!/usr/bin/env node

import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import ffmpeg from "fluent-ffmpeg";
import yaml from "js-yaml";

const FORCE = process.argv.includes("--force");
const QUIET = process.argv.includes("--quiet");

const ASSETS_ROOT = path.resolve("src/assets");
const CONTENT_WORK_ROOT = path.resolve("src/content/work");
const OG_ROOT = path.join(ASSETS_ROOT, "og");
const PAGE_OG_ROOT = path.join(OG_ROOT, "pages");
const WORK_OG_ROOT = path.join(OG_ROOT, "work");

const PAGE_WIDTH = 1200;
const PAGE_HEIGHT = 630;
const WORK_WIDTH = 960;
const WORK_HEIGHT = 504;

const VIDEO_EXT_RE = /\.(mp4|webm|ogg|mov|m4v)$/i;
const WORK_FILE_RE = /\.(md|mdx)$/i;

const PAGE_SOURCES = {
  index: "/assets/thumbnails/index.jpg",
  about: "/assets/thumbnails/about.jpg",
  lab: "/assets/thumbnails/lab.jpg",
  work: "/assets/thumbnails/work.jpg",
  teaching: "/assets/teaching/core-2.mp4",
  resume: "/assets/profile.jpg",
  calendar: "/assets/about/P7200611.JPG",
  pattern: "/assets/threads/smoke.mp4",
  "404": "/assets/thumbnails/404.jpg",
};

const ensureDir = async (dir) => {
  await fs.mkdir(dir, { recursive: true });
};

const stripQuery = (value) => String(value || "").split("?")[0];

const resolveAssetPath = (source) => {
  const raw = stripQuery(source).trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw) || /^data:|^blob:/i.test(raw)) return null;

  if (raw.startsWith("/assets/")) {
    return path.join(ASSETS_ROOT, raw.slice("/assets/".length));
  }

  if (raw.startsWith("/")) {
    return path.join(ASSETS_ROOT, raw.slice(1));
  }

  return path.join(ASSETS_ROOT, raw);
};

const renderOgImage = (inputPath, outputPath, width, height) =>
  new Promise((resolve, reject) => {
    let command = ffmpeg(inputPath);
    if (VIDEO_EXT_RE.test(inputPath)) {
      command = command.seekInput(0.4);
    }

    command
      .outputOptions([
        "-frames:v 1",
        "-vf",
        `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`,
        "-q:v 4",
      ])
      .output(outputPath)
      .on("end", resolve)
      .on("error", reject)
      .run();
  });

const parseFrontmatter = async (filePath) => {
  const raw = await fs.readFile(filePath, "utf8");
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return {};
  const parsed = yaml.load(match[1]);
  return parsed && typeof parsed === "object" ? parsed : {};
};

const mediaCandidates = (frontmatter) => {
  const values = [];

  const pushValue = (value) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (Array.isArray(item)) {
          if (item[0]) values.push(item[0]);
          return;
        }
        values.push(item);
      });
      return;
    }
    values.push(value);
  };

  pushValue(frontmatter.heroImage);
  pushValue(frontmatter.images);
  return values;
};

const cleanupDir = async (dir, expectedNames) => {
  if (!existsSync(dir)) return;
  const entries = await fs.readdir(dir);
  await Promise.all(
    entries
      .filter((entry) => entry.toLowerCase().endsWith(".jpg"))
      .filter((entry) => !expectedNames.has(entry))
      .map((entry) => fs.rm(path.join(dir, entry), { force: true })),
  );
};

const generatePageOgImages = async () => {
  await ensureDir(PAGE_OG_ROOT);
  const expectedNames = new Set();

  for (const [name, source] of Object.entries(PAGE_SOURCES)) {
    const outputName = `${name}.jpg`;
    expectedNames.add(outputName);
    const outputPath = path.join(PAGE_OG_ROOT, outputName);

    if (!FORCE && existsSync(outputPath)) {
      if (!QUIET) {
        console.log(`OG page image exists, skipping: ${outputName}`);
      }
      continue;
    }

    const inputPath = resolveAssetPath(source);
    if (!inputPath || !existsSync(inputPath)) {
      console.warn(`OG page source missing for ${name}: ${source}`);
      continue;
    }

    await renderOgImage(inputPath, outputPath, PAGE_WIDTH, PAGE_HEIGHT);
    if (!QUIET) {
      console.log(`Generated OG page image: ${outputName}`);
    }
  }

  await cleanupDir(PAGE_OG_ROOT, expectedNames);
};

const generateWorkOgImages = async () => {
  await ensureDir(WORK_OG_ROOT);
  const expectedNames = new Set();

  const entries = await fs.readdir(CONTENT_WORK_ROOT);
  const workFiles = entries.filter((entry) => WORK_FILE_RE.test(entry)).sort();

  for (const fileName of workFiles) {
    const slug = fileName.replace(WORK_FILE_RE, "");
    const outputName = `${slug}.jpg`;
    expectedNames.add(outputName);
    const outputPath = path.join(WORK_OG_ROOT, outputName);

    if (!FORCE && existsSync(outputPath)) {
      if (!QUIET) {
        console.log(`OG work image exists, skipping: ${outputName}`);
      }
      continue;
    }

    const filePath = path.join(CONTENT_WORK_ROOT, fileName);
    const frontmatter = await parseFrontmatter(filePath);
    const candidates = mediaCandidates(frontmatter);

    let inputPath = null;
    for (const candidate of candidates) {
      const resolved = resolveAssetPath(candidate);
      if (resolved && existsSync(resolved)) {
        inputPath = resolved;
        break;
      }
    }

    if (!inputPath) {
      console.warn(`OG work source missing for ${slug}`);
      continue;
    }

    await renderOgImage(inputPath, outputPath, WORK_WIDTH, WORK_HEIGHT);
    if (!QUIET) {
      console.log(`Generated OG work image: ${outputName}`);
    }
  }

  await cleanupDir(WORK_OG_ROOT, expectedNames);
};

const main = async () => {
  await ensureDir(OG_ROOT);
  await generatePageOgImages();
  await generateWorkOgImages();
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

