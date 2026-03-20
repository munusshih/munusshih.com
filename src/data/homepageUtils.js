function firstDefined(values) {
  for (const value of values) {
    if (value !== undefined && value !== null) {
      if (typeof value === "string") {
        if (value.trim().length > 0) return value;
      } else {
        return value;
      }
    }
  }
  return undefined;
}

function firstDefinedString(values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

export function homepageEntryKey(entry) {
  if (!entry || typeof entry !== "object") return "";

  const type = entry.type ?? "";
  const href = entry.href ?? entry.link?.href ?? entry.url ?? "";
  const target = Array.isArray(entry.targetName)
    ? entry.targetName.join("|")
    : (entry.targetName ?? "");

  return [type, href, target].join("|");
}

export function parseVisibilityFlag(value) {
  if (value === undefined || value === null) return true;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;

  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return true;

  const disabledTokens = new Set([
    "off",
    "false",
    "0",
    "no",
    "hide",
    "hidden",
    "disable",
    "disabled",
    "inactive",
    "draft",
    "archived",
  ]);

  const enabledTokens = new Set([
    "on",
    "true",
    "1",
    "yes",
    "show",
    "visible",
    "enable",
    "enabled",
    "active",
    "published",
    "live",
  ]);

  if (disabledTokens.has(normalized)) return false;
  if (enabledTokens.has(normalized)) return true;

  if (/(^|[\s_-])off($|[\s_-])/.test(normalized)) return false;
  if (/(^|[\s_-])on($|[\s_-])/.test(normalized)) return true;

  if (normalized.includes("disable") || normalized.includes("hidden")) {
    return false;
  }
  if (normalized.includes("enable") || normalized.includes("visible")) {
    return true;
  }

  return true;
}

export function isHomepageEntryEnabled(entry) {
  const value = firstDefined([
    entry?.status,
    entry?.onOff,
    entry?.enabled,
    entry?.visibility,
    entry?.active,
    entry?.isOn,
  ]);
  return parseVisibilityFlag(value);
}

export function parseMediaList(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item ?? "").trim())
      .filter(Boolean);
  }
  if (typeof value !== "string") return [];

  const trimmed = value.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => String(item ?? "").trim())
        .filter(Boolean);
    }
  } catch (_error) {
    // ignore JSON parse errors
  }

  const delimiter = ["|", "\n", ","].find((sep) => trimmed.includes(sep));
  if (!delimiter) return [trimmed];

  return trimmed
    .split(delimiter)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function resolveHomepageTitle(entry) {
  return firstDefinedString([
    entry?.title,
    entry?.linkContent,
    entry?.linkLabel,
    entry?.heading,
    entry?.listTitle,
    entry?.name,
  ]);
}

export function resolveHomepageBody(entry) {
  return firstDefinedString([
    entry?.body,
    entry?.description,
    entry?.excerpt,
    entry?.text,
    entry?.summary,
    entry?.note,
  ]);
}

export function normaliseHomepageContentAliases(entry) {
  if (!entry || typeof entry !== "object") return entry;

  const title = resolveHomepageTitle(entry);
  const body = resolveHomepageBody(entry);

  return {
    ...entry,
    title: entry.title || title || "",
    linkContent: entry.linkContent || title || "",
    body: entry.body || body || "",
    description: entry.description || body || "",
  };
}
