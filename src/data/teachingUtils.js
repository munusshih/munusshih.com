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
