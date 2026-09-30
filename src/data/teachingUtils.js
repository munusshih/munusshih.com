export function teachingEntryKey(entry) {
  const title = entry?.title ?? "";
  const date = entry?.originalDate ?? entry?.date ?? "";
  const href =
    entry?.link?.href ??
    entry?.link ??
    entry?.href ??
    entry?.url ??
    entry?.source ??
    "";

  return [title, date, href].join("|");
}

export function entryHasTokens(entry, keywords) {
  if (!entry) return false;
  const list = Array.isArray(keywords) ? keywords : [keywords];

  const rawValues = [
    entry.section,
    entry.category,
    entry.type,
    entry.status,
    entry.tag,
    entry.tags,
    entry.note,
  ];

  const tokens = rawValues
    .flat()
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  return list.some((keyword) => {
    const lowerKeyword = String(keyword).toLowerCase();
    return tokens.some((token) => token.includes(lowerKeyword));
  });
}

const academicTermDatePattern = /\b(?:spring|summer|fall|winter)\s+\d{4}\b/i;

export function isShortTeachingEvent(entry) {
  const type = String(entry?.type || "").toLowerCase();

  if (type.includes("workshop")) return true;
  if (!type.includes("class")) return false;

  const date = String(entry?.originalDate ?? entry?.date ?? "");
  return !academicTermDatePattern.test(date);
}

export function mergeEventsWithShortTeachingEntries(
  eventEntries = [],
  teachingEntries = [],
) {
  const entries = [
    ...eventEntries,
    ...teachingEntries.filter(isShortTeachingEvent),
  ];
  const seen = new Set();

  return entries.filter((entry) => {
    const key = teachingEntryKey(entry);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
