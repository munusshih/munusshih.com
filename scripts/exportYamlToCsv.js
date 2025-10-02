import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const rootDir = join(__dirname, "..");
const outputDir = join(rootDir, "spreadsheets");

const datasets = [
  {
    name: "press",
    source: join(rootDir, "src/docs/press.yml"),
    columns: ["title", "place", "date", "tag", "quote", "link"],
  },
  {
    name: "events",
    source: join(rootDir, "src/docs/events.yml"),
    columns: [
      "title",
      "date",
      "type",
      "place",
      "excerpt",
      "link",
    ],
  },
  {
    name: "books",
    source: join(rootDir, "src/docs/books.yml"),
    columns: ["title", "isbn", "date", "link", "image", "quote"],
  },
  {
    name: "organizing",
    source: join(rootDir, "src/docs/organizing.yml"),
    columns: ["title", "date", "place", "type", "excerpt", "link"],
  },
  {
    name: "experiences",
    source: join(rootDir, "src/docs/experiences.yml"),
    columns: ["title", "date", "type", "place", "note", "link"],
  },
  {
    name: "education",
    source: join(rootDir, "src/docs/education.yml"),
    columns: ["title", "date", "place", "note", "link"],
  },
  {
    name: "lab",
    source: join(rootDir, "src/docs/lab.yml"),
    columns: ["description", "href", "image", "imageAlt", "tags"],
  },
  {
    name: "homepage",
    source: join(rootDir, "src/docs/homepage.yml"),
    columns: [
      "order",
      "type",
      "size",
      "body",
      "title",
      "linkContent",
      "linkLabel",
      "href",
      "description",
      "targetName",
      "iframe",
      "height",
      "background",
      "textColor",
    ],
  },
];

const extraFields = {
  events: ["tag"],
  press: ["excerpt"],
};

function extractValue(entry, key) {
  if (key === "link") {
    if (entry.link?.href) return entry.link.href;
    if (typeof entry.link === "string") return entry.link;
    return "";
  }
  if (key === "classes" && Array.isArray(entry.classes)) {
    return entry.classes.map((c) => c.title).join("; ");
  }
  if (key === "targetName" && Array.isArray(entry.targetName)) {
    return entry.targetName.join(" | ");
  }
  const value = entry[key];
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).join("; ");
  }
  return value == null ? "" : String(value).replace(/\r?\n/g, " ");
}

function stringifyRow(values) {
  return values
    .map((value) => {
      const needsEscaping = /[",\n]/.test(value);
      if (needsEscaping) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    })
    .join(",");
}

async function convertDataset(dataset) {
  const file = await readFile(dataset.source, "utf-8");
  const parsed = yaml.load(file);

  if (!Array.isArray(parsed)) {
    console.warn(`Skipping ${dataset.name}: YAML root is not an array.`);
    return;
  }

  const columns = [...dataset.columns];
  const optional = extraFields[dataset.name] || [];
  optional.forEach((field) => {
    if (!columns.includes(field)) columns.push(field);
  });

  const rows = parsed.map((entry) =>
    columns.map((column) => extractValue(entry, column))
  );

  const csv = [stringifyRow(columns), ...rows.map(stringifyRow)].join("\n");
  const target = join(outputDir, `${dataset.name}.csv`);
  await writeFile(target, csv, "utf-8");
  console.log(`Exported ${dataset.name} -> ${target}`);
}

async function run() {
  await mkdir(outputDir, { recursive: true });
  for (const dataset of datasets) {
    await convertDataset(dataset);
  }
}

run().catch((error) => {
  console.error("Failed to export YAML datasets", error);
  process.exitCode = 1;
});
