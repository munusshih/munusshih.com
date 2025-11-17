#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FORCE = process.argv.includes("--force");
const QUIET = process.argv.includes("--quiet");

const WORKDIR = path.resolve(__dirname, "..");
const ENV_PATH = path.resolve(WORKDIR, ".env");

const BASE_SHEET_ENV_KEYS = [
  "GOOGLE_SHEET_ID",
  "SHEET_ID",
  "CONTENT_SHEET_ID",
];

const DATASETS = [
  {
    key: "press",
    fallback: "src/docs/press.yml",
    defaultTab: "Press",
    urlEnvKeys: ["PRESS_SHEET_URL", "LISTCARD_PRESS_SHEET_URL"],
    tabEnvKeys: ["PRESS_TAB_NAME"],
  },
  {
    key: "events",
    fallback: "src/docs/events.yml",
    defaultTab: "Events",
    urlEnvKeys: ["EVENTS_SHEET_URL", "LISTCARD_EVENTS_SHEET_URL"],
    tabEnvKeys: ["EVENTS_TAB_NAME"],
  },
  {
    key: "experiences",
    fallback: "src/docs/experiences.yml",
    defaultTab: "Experiences",
    urlEnvKeys: ["EXPERIENCES_SHEET_URL"],
    tabEnvKeys: ["EXPERIENCES_TAB_NAME"],
  },
  {
    key: "education",
    fallback: "src/docs/education.yml",
    defaultTab: "Education",
    urlEnvKeys: ["EDUCATION_SHEET_URL"],
    tabEnvKeys: ["EDUCATION_TAB_NAME"],
  },
  {
    key: "lab",
    fallback: "src/docs/lab.yml",
    defaultTab: "Lab",
    urlEnvKeys: ["LAB_SHEET_URL"],
    tabEnvKeys: ["LAB_TAB_NAME"],
  },
  {
    key: "writing",
    fallback: "src/docs/writing.yml",
    defaultTab: "Writing",
    urlEnvKeys: ["WRITING_SHEET_URL"],
    tabEnvKeys: ["WRITING_TAB_NAME"],
  },
  {
    key: "teaching",
    fallback: "src/docs/teaching.yml",
    defaultTab: "Teaching",
    urlEnvKeys: ["TEACHING_SHEET_URL", "TEACHING_TAB_URL"],
    tabEnvKeys: ["TEACHING_TAB_NAME"],
  },
  {
    key: "homepage",
    fallback: "src/docs/homepage.yml",
    defaultTab: "Homepage",
    urlEnvKeys: ["HOMEPAGE_SHEET_URL"],
    tabEnvKeys: ["HOMEPAGE_TAB_NAME"],
  },
  {
    key: "commons",
    fallback: "src/docs/commons.yml",
    defaultTab: "Commons",
    urlEnvKeys: ["COMMONS_SHEET_URL"],
    tabEnvKeys: ["COMMONS_TAB_NAME"],
  },
];

const KEY_MAP = {
  title: "title",
  date: "date",
  quote: "quote",
  place: "place",
  location: "place",
  type: "type",
  tag: "tag",
  note: "note",
  excerpt: "excerpt",
  description: "excerpt",
  summary: "excerpt",
  publication: "publication",
  image: "image",
  cover: "image",
  thumbnail: "image",
  imagealt: "imageAlt",
  background: "background",
  backgroundcolor: "background",
  bg: "background",
  textcolor: "textColor",
  textcolour: "textColor",
  color: "textColor",
  body: "body",
  text: "body",
  linklabel: "linkLabel",
  size: "size",
  href: "href",
  linkcontent: "linkContent",
  linktext: "linkContent",
  iframe: "iframe",
  height: "height",
  order: "order",
  section: "section",
  category: "category",
  status: "status",
  ogimage: "ogImage",
  "og image": "ogImage",
  preview: "ogImage",
  img: "image",
  img1: "img1",
  "img 1": "img1",
  img2: "img2",
  "img 2": "img2",
  img3: "img3",
  "img 3": "img3",
};

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
    if (mapped === "body" || mapped === "targetName") {
      target[mapped] = value;
      return;
    }
    if (mapped === "excerpt" && target.excerpt && target.excerpt !== value) {
      return;
    }
    if (mapped === "tags") {
      target.tags = parseList(value);
      return;
    }
    target[mapped] = value;
    return;
  }

  if (normalised === "tags") {
    target.tags = parseList(value);
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

const resolveSheetUrl = (dataset) => {
  for (const key of dataset.urlEnvKeys || []) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  const baseId = (() => {
    for (const key of BASE_SHEET_ENV_KEYS) {
      const value = process.env[key];
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
    return undefined;
  })();

  if (!baseId) return undefined;

  const tabName =
    dataset.tabEnvKeys
      ?.map((key) => process.env[key])
      .find((value) => typeof value === "string" && value.trim())?.trim() ||
    dataset.defaultTab;

  if (!tabName) return undefined;

  return `https://opensheet.elk.sh/${baseId}/${encodeURIComponent(tabName)}`;
};

const loadSheet = async (dataset) => {
  const url = resolveSheetUrl(dataset);
  if (!url) return [];

  try {
    const response = await fetch(url, { redirect: "follow" });
    if (!response.ok) {
      if (!QUIET) {
        console.warn(`Failed to fetch ${dataset.key}: ${response.status}`);
      }
      return [];
    }
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    if (!QUIET) {
      console.warn(`Fetch error for ${dataset.key}`, error);
    }
    return [];
  }
};

const normaliseRows = (rows) =>
  rows.map((row) => {
    const entry = {};
    for (const [key, value] of Object.entries(row)) {
      assignKey(entry, key, value);
    }
    return entry;
  });

const writeYaml = async (filePath, data) => {
  const absolute = path.resolve(WORKDIR, filePath);
  const content = yaml.dump(data, {
    lineWidth: -1,
    noRefs: true,
  });
  await fs.writeFile(absolute, content, "utf8");
};

const main = async () => {
  await loadEnvFile();

  for (const dataset of DATASETS) {
    const rows = await loadSheet(dataset);
    if (!rows.length) {
      if (!QUIET) {
        console.warn(
          `No data for ${dataset.key} — skipping YAML update (check sheet/tab)`,
        );
      }
      continue;
    }

    const normalised = normaliseRows(rows).filter(
      (entry) => entry && Object.keys(entry).length > 0,
    );

    if (!normalised.length) continue;

    await writeYaml(dataset.fallback, normalised);

    if (!QUIET) {
      console.log(
        `Updated ${dataset.fallback} with ${normalised.length} record(s) from ${dataset.key}`,
      );
    }
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
