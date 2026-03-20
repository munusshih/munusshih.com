#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const WORKDIR = process.cwd();
const FORCE = process.argv.includes("--force");
const QUIET = process.argv.includes("--quiet");

const TEACHING_MANIFEST = path.resolve(
  WORKDIR,
  "src/data/generated/teachingMedia.json",
);
const HOMEPAGE_MANIFEST = path.resolve(
  WORKDIR,
  "src/data/generated/homepageMedia.json",
);
const SRC_ASSETS_ROOT = path.resolve(WORKDIR, "src/assets");
const OG_PAGE_ROOT = path.resolve(WORKDIR, "src/assets/og/pages");
const OG_WORK_ROOT = path.resolve(WORKDIR, "src/assets/og/work");
const WORK_CONTENT_ROOT = path.resolve(WORKDIR, "src/content/work");

const runScript = (script, args = []) => {
  const result = spawnSync("npm", ["run", script, "--", ...args], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const collectAssetRefs = (value, refs) => {
  if (Array.isArray(value)) {
    value.forEach((item) => collectAssetRefs(item, refs));
    return;
  }

  if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectAssetRefs(item, refs));
    return;
  }

  if (typeof value !== "string") return;

  const src = value.split("?")[0];
  if (src.startsWith("/assets/") || src.startsWith("/teaching/")) {
    refs.add(src);
  }
};

const resolveAssetPath = (src) => {
  if (src.startsWith("/assets/")) {
    return path.join(SRC_ASSETS_ROOT, src.slice("/assets/".length));
  }
  if (src.startsWith("/teaching/")) {
    return path.join(SRC_ASSETS_ROOT, "teaching", src.slice("/teaching/".length));
  }
  return null;
};

const manifestIsHealthy = (manifestPath) => {
  if (!existsSync(manifestPath)) return false;

  let parsed;
  try {
    parsed = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (_error) {
    return false;
  }

  const refs = new Set();
  collectAssetRefs(parsed, refs);

  for (const src of refs) {
    const resolvedPath = resolveAssetPath(src);
    if (!resolvedPath) continue;
    if (!existsSync(resolvedPath)) {
      return false;
    }
  }

  return true;
};

const ogImagesAreHealthy = () => {
  const requiredPages = [
    "index.jpg",
    "about.jpg",
    "lab.jpg",
    "work.jpg",
    "teaching.jpg",
    "resume.jpg",
    "calendar.jpg",
    "pattern.jpg",
    "404.jpg",
  ];

  for (const fileName of requiredPages) {
    if (!existsSync(path.join(OG_PAGE_ROOT, fileName))) {
      return false;
    }
  }

  let workEntries = [];
  try {
    workEntries = readdirSync(WORK_CONTENT_ROOT)
      .filter((entry) => /\.(md|mdx)$/i.test(entry))
      .map((entry) => entry.replace(/\.(md|mdx)$/i, ""));
  } catch (_error) {
    return false;
  }

  for (const slug of workEntries) {
    if (!existsSync(path.join(OG_WORK_ROOT, `${slug}.jpg`))) {
      return false;
    }
  }

  return true;
};

if (!QUIET) {
  console.log("prepare:dev: syncing sheets");
}
runScript("sync:yml", ["--quiet"]);

const teachingHealthy = manifestIsHealthy(TEACHING_MANIFEST);
if (FORCE || !teachingHealthy) {
  if (!QUIET) {
    console.log("prepare:dev: refreshing teaching media cache");
  }
  const args = FORCE ? ["--quiet", "--force"] : ["--quiet"];
  runScript("cache:teaching-media", args);
} else if (!QUIET) {
  console.log("prepare:dev: teaching media cache is healthy, skipping");
}

const homepageHealthy = manifestIsHealthy(HOMEPAGE_MANIFEST);
if (FORCE || !homepageHealthy) {
  if (!QUIET) {
    console.log("prepare:dev: refreshing homepage media cache");
  }
  const args = FORCE ? ["--quiet", "--force"] : ["--quiet"];
  runScript("cache:homepage-media", args);
} else if (!QUIET) {
  console.log("prepare:dev: homepage media cache is healthy, skipping");
}

const ogHealthy = ogImagesAreHealthy();
if (FORCE || !ogHealthy) {
  if (!QUIET) {
    console.log("prepare:dev: generating OG images");
  }
  const args = FORCE ? ["--quiet", "--force"] : ["--quiet"];
  runScript("generate:og", args);
} else if (!QUIET) {
  console.log("prepare:dev: OG image cache is healthy, skipping");
}

if (!QUIET) {
  console.log("prepare:dev: syncing public/assets symlink");
}
runScript("sync:work-assets");
