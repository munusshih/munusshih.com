export function parseLooseDate(input) {
  let clean = String(input).trim().replace(",", "");

  if (clean.toLowerCase() === "now") {
    return new Date();
  }

  // Handle "spring" as January and "fall" as August
  if (clean.toLowerCase().includes("spring")) {
    clean = clean.replace(/spring/i, "January");
  } else if (clean.toLowerCase().includes("fall")) {
    clean = clean.replace(/fall/i, "August");
  }

  if (/^\d{4}$/.test(clean)) clean = `January 1, ${clean}`;
  else if (/^[A-Za-z]+\s+\d{4}$/.test(clean)) clean += " 1";

  return new Date(clean);
}

export function cleanLooseDate(input) {
  const date = parseLooseDate(input);

  if (isNaN(date)) {
    return String(input).trim().replace(",", "");
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
  });
}

export function dateToSortable(input) {
  return new Date(String(input).trim().replace(",", ""));
}

export function prepareAndSortContent(content) {
  return content
    .map((item) => ({
      ...item,
      originalDate: item.date,
      date: item.date ? cleanLooseDate(item.date) : undefined,
      _sortDate: item.date ? dateToSortable(item.date) : undefined,
    }))
    .sort((a, b) =>
      a._sortDate && b._sortDate ? b._sortDate - a._sortDate : 0,
    );
}

export function formatDateRange(startDate, endDate) {
  const startYear = cleanLooseDate(startDate).split(" ")[1];

  if (endDate === "now") return `${startYear} — now`;

  const endYear = endDate ? cleanLooseDate(endDate).split(" ")[1] : null;

  return startYear === endYear || !endYear
    ? startYear
    : `${startYear} — ${endYear}`;
}

export function sortByDate(items, order = "desc") {
  return items.sort((a, b) => {
    const startA = new Date(cleanLooseDate(a.data.startDate)).getTime();
    const startB = new Date(cleanLooseDate(b.data.startDate)).getTime();
    const endA = a.data.endDate
      ? new Date(cleanLooseDate(a.data.endDate)).getTime()
      : null;
    const endB = b.data.endDate
      ? new Date(cleanLooseDate(b.data.endDate)).getTime()
      : null;

    if (isNaN(startA) || isNaN(startB)) return 0; // If either startDate is invalid, leave them in place

    // Compare startDate first
    if (startA !== startB) {
      return order === "desc" ? startB - startA : startA - startB;
    }

    // If startDate is the same, compare endDate (if available)
    if (endA !== endB) {
      if (endA === null) return order === "desc" ? 1 : -1;
      if (endB === null) return order === "desc" ? -1 : 1;
      return order === "desc" ? endB - endA : endA - endB;
    }

    return 0;
  });
}
