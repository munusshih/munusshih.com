import Press from "@/docs/press.yml";
import Events from "@/docs/events.yml";
import Experiences from "@/docs/experiences.yml";
import Education from "@/docs/education.yml";
import Lab from "@/docs/lab.yml";
import Homepage from "@/docs/homepage.yml";
import Writing from "@/docs/writing.yml";
import Teaching from "@/docs/teaching.yml";
import Commons from "@/docs/commons.yml";

const DATASETS = {
  press: {
    fallback: Press,
    defaultTab: "Press",
    urlEnvKeys: ["PRESS_SHEET_URL", "LISTCARD_PRESS_SHEET_URL"],
  },
  events: {
    fallback: Events,
    defaultTab: "Events",
    urlEnvKeys: ["EVENTS_SHEET_URL", "LISTCARD_EVENTS_SHEET_URL"],
  },
  experiences: {
    fallback: Experiences,
    defaultTab: "Experiences",
    urlEnvKeys: ["EXPERIENCES_SHEET_URL"],
  },
  education: {
    fallback: Education,
    defaultTab: "Education",
    urlEnvKeys: ["EDUCATION_SHEET_URL"],
  },
  lab: {
    fallback: Lab,
    defaultTab: "Lab",
    urlEnvKeys: ["LAB_SHEET_URL"],
  },
  writing: {
    fallback: Writing,
    defaultTab: "Writing",
    urlEnvKeys: ["WRITING_SHEET_URL"],
  },
  homepage: {
    fallback: Homepage,
    defaultTab: "Homepage",
    urlEnvKeys: ["HOMEPAGE_SHEET_URL"],
  },
  teaching: {
    fallback: Teaching,
    defaultTab: "Teaching",
    urlEnvKeys: ["TEACHING_SHEET_URL"],
  },
  commons: {
    fallback: Commons,
    defaultTab: "Commons",
    urlEnvKeys: ["COMMONS_SHEET_URL"],
  },
};

const BASE_SHEET_ENV_KEYS = ["GOOGLE_SHEET_ID", "SHEET_ID", "CONTENT_SHEET_ID"];

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
  collaboration: "collaboration",
  collaborator: "collaboration",
  collaborators: "collaboration",
  publication: "publication",
  image: "image",
  cover: "image",
  thumbnail: "image",
  isbn: "isbn",
  imagealt: "imageAlt",
  ogimage: "ogImage",
  og_image: "ogImage",
  preview: "ogImage",
  previewimage: "ogImage",
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
  collection: "section",
  group: "section",
  tags: "tags",
};

function resolveSheetUrl(datasetKey) {
  const dataset = DATASETS[datasetKey];
  if (!dataset) return undefined;

  for (const envKey of dataset.urlEnvKeys || []) {
    const value = import.meta.env?.[envKey];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  const baseSheetId = getBaseSheetId();
  if (!baseSheetId) return undefined;

  const tabName = getTabName(datasetKey);
  if (!tabName) return undefined;

  return `https://opensheet.elk.sh/${baseSheetId}/${encodeURIComponent(tabName)}`;
}

function getBaseSheetId() {
  for (const key of BASE_SHEET_ENV_KEYS) {
    const value = import.meta.env?.[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function getTabName(datasetKey) {
  const dataset = DATASETS[datasetKey];
  if (!dataset) return undefined;

  for (const key of dataset.tabEnvKeys || []) {
    const value = import.meta.env?.[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return dataset.defaultTab;
}

async function fetchSheetRows(url) {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      // Extract tab name from URL for better error messaging
      const urlParts = url.split('/');
      const tabName = urlParts[urlParts.length - 1];
      console.warn(`contentSources: failed to fetch tab "${decodeURIComponent(tabName)}" – ${response.status}. Tab might not exist in the sheet.`);
      return [];
    }
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    const urlParts = url.split('/');
    const tabName = urlParts[urlParts.length - 1];
    console.warn(`contentSources: fetch error for tab "${decodeURIComponent(tabName)}"`, error);
    return [];
  }
}

function normaliseKey(key) {
  return key?.toString().trim().toLowerCase();
}

function parseList(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return value;
  return value
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseTargetValue(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return value;

  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed;
  } catch (error) {
    // ignore JSON parse errors
  }

  const delimiter = ["|", "\n", ","].find((sep) => trimmed.includes(sep));
  if (delimiter) {
    return trimmed
      .split(delimiter)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  return trimmed;
}

function assignKey(target, key, value, datasetKey) {
  if (value === undefined || value === null) return;

  const trimmedValue = typeof value === "string" ? value.trim() : value;
  if (trimmedValue === "") return;

  const normalised = normaliseKey(key);
  if (!normalised) return;

  if (datasetKey === "homepage") {
    if (["component", "card"].includes(normalised)) {
      target.type = trimmedValue;
      return;
    }
    if (["description", "excerpt"].includes(normalised)) {
      target.description = trimmedValue;
      return;
    }
    if (["target", "targetname", "targets"].includes(normalised)) {
      target.targetName = parseTargetValue(trimmedValue);
      return;
    }
    if (normalised === "order") {
      const orderValue = Number(trimmedValue);
      target.order = Number.isFinite(orderValue) ? orderValue : trimmedValue;
      return;
    }
    if (normalised === "height") {
      const numeric = Number(trimmedValue);
      target.height = Number.isFinite(numeric) ? numeric : trimmedValue;
      return;
    }
  }

  if (["link", "url", "href"].includes(normalised)) {
    target.link = { href: String(trimmedValue) };
    return;
  }

  const mapped = KEY_MAP[normalised];
  if (mapped) {
    target[mapped] = trimmedValue;
    return;
  }

  if (normalised === "tags") {
    const parsed = parseList(trimmedValue);
    target.tags = parsed;
    return;
  }

  if (datasetKey === "homepage" && normalised === "linkhref") {
    target.href = trimmedValue;
    return;
  }

  // Preserve other fields (convert spaces and hyphens to camelCase-like keys)
  const safeKey = key
    .toString()
    .trim()
    .replace(/[^a-zA-Z0-9]+([a-zA-Z0-9])/g, (_, char) => char.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, "");

  if (safeKey.length > 0) {
    const lowerFirst = safeKey[0].toLowerCase() + safeKey.slice(1);
    target[lowerFirst] = trimmedValue;
  }
}

function cloneData(data) {
  return JSON.parse(JSON.stringify(data));
}

async function loadDataset(datasetKey) {
  const dataset = DATASETS[datasetKey];
  if (!dataset) return [];

  const sheetUrl = resolveSheetUrl(datasetKey);

  if (!sheetUrl) {
    return cloneData(dataset.fallback) || [];
  }

  const rows = await fetchSheetRows(sheetUrl);

  if (!rows.length) {
    return cloneData(dataset.fallback) || [];
  }

  const normalised = [];

  for (const row of rows) {
    const entry = {};
    for (const [key, value] of Object.entries(row)) {
      assignKey(entry, key, value, datasetKey);
    }

    const processed = postProcessEntry(datasetKey, entry);
    if (processed) {
      normalised.push(processed);
    }
  }

  if (!normalised.length) {
    return cloneData(dataset.fallback) || [];
  }

  if (datasetKey === "homepage") {
    normalised.sort((a, b) => {
      const orderA = Number.isFinite(a.order) ? a.order : Number(a.order);
      const orderB = Number.isFinite(b.order) ? b.order : Number(b.order);

      const safeA = Number.isFinite(orderA) ? orderA : Number.MAX_SAFE_INTEGER;
      const safeB = Number.isFinite(orderB) ? orderB : Number.MAX_SAFE_INTEGER;
      return safeA - safeB;
    });
  }

  return normalised;
}

function postProcessEntry(datasetKey, entry) {
  if (!entry || typeof entry !== 'object' || Object.keys(entry).length === 0) return null;

  if (datasetKey === "homepage") {
    const type = entry.type || entry.title;
    if (!type) return null;

    const normalized = {
      ...entry,
      type: String(type).trim(),
    };

    if (normalized.targetName && Array.isArray(normalized.targetName)) {
      normalized.targetName = normalized.targetName.map((item) =>
        typeof item === "string" ? item.trim() : item,
      );
    }

    return normalized;
  }

  return entry;
}

export async function getPressEntries() {
  return loadDataset("press");
}

export async function getEventEntries() {
  return loadDataset("events");
}

export async function getExperienceEntries() {
  return loadDataset("experiences");
}

export async function getEducationEntries() {
  return loadDataset("education");
}

export async function getLabEntries() {
  return loadDataset("lab");
}

export async function getHomepageEntries() {
  return loadDataset("homepage");
}

export async function getWritingEntries() {
  return loadDataset("writing");
}

export async function getTeachingEntries() {
  return loadDataset("teaching");
}

export async function getCommonsEntries() {
  return loadDataset("commons");
}
