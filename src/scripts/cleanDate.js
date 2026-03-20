function cleanInput(input) {
  return String(input ?? "").trim();
}

function stripCommas(input) {
  return input.replace(/,/g, "");
}

function isValidDate(date) {
  return date instanceof Date && !Number.isNaN(date.valueOf());
}

function hasDayPrecision(input) {
  const raw = cleanInput(input);
  return (
    /^[A-Za-z]+\s+\d{1,2},?\s+\d{4}$/.test(raw) ||
    /^\d{4}-\d{1,2}-\d{1,2}$/.test(raw)
  );
}

export function parseLooseDate(input, { preferEndOfPeriod = false } = {}) {
  const raw = cleanInput(input);
  const clean = stripCommas(raw);

  if (!clean) return new Date(NaN);

  if (clean.toLowerCase() === "now") {
    return new Date();
  }

  const seasonMatch = clean.match(/^(spring|summer|fall|winter)\s+(\d{4})$/i);
  if (seasonMatch) {
    const season = seasonMatch[1].toLowerCase();
    const year = Number(seasonMatch[2]);
    const bounds = {
      spring: { startMonth: 0, endMonth: 4, endYearOffset: 0 },
      summer: { startMonth: 5, endMonth: 7, endYearOffset: 0 },
      fall: { startMonth: 7, endMonth: 10, endYearOffset: 0 },
      winter: { startMonth: 11, endMonth: 1, endYearOffset: 1 },
    };
    const config = bounds[season];
    if (!config) return new Date(NaN);

    if (!preferEndOfPeriod) {
      return new Date(year, config.startMonth, 1);
    }

    return new Date(
      year + config.endYearOffset,
      config.endMonth + 1,
      0,
      23,
      59,
      59,
      999
    );
  }

  const yearMatch = clean.match(/^(\d{4})$/);
  if (yearMatch) {
    const year = Number(yearMatch[1]);
    return preferEndOfPeriod
      ? new Date(year, 11, 31, 23, 59, 59, 999)
      : new Date(year, 0, 1);
  }

  const monthYearMatch = clean.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (monthYearMatch) {
    const month = monthYearMatch[1];
    const year = Number(monthYearMatch[2]);
    const start = new Date(`${month} 1, ${year}`);
    if (!isValidDate(start)) return start;

    if (!preferEndOfPeriod) {
      return start;
    }

    return new Date(
      start.getFullYear(),
      start.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );
  }

  return new Date(clean);
}

export function cleanLooseDate(input) {
  const raw = cleanInput(input);
  const date = parseLooseDate(raw);

  if (!isValidDate(date)) {
    return stripCommas(raw);
  }

  const options = hasDayPrecision(raw)
    ? { year: "numeric", month: "short", day: "numeric" }
    : { year: "numeric", month: "short" };

  return date.toLocaleDateString("en-US", options);
}

export function dateToSortable(input) {
  return parseLooseDate(input);
}

export function isRecentOrUpcomingDate(
  input,
  { now = new Date() } = {}
) {
  const start = parseLooseDate(input);
  const end = parseLooseDate(input, { preferEndOfPeriod: true });
  if (!isValidDate(start) || !isValidDate(end)) return false;

  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const afterNextMonthStart = new Date(now.getFullYear(), now.getMonth() + 2, 1);

  return end >= thisMonthStart && start < afterNextMonthStart;
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
  const startYearMatch = cleanLooseDate(startDate).match(/\b\d{4}\b/);
  const startYear = startYearMatch ? startYearMatch[0] : "";

  if (endDate === "now") return `${startYear} — now`;

  const endYear = endDate
    ? (cleanLooseDate(endDate).match(/\b\d{4}\b/)?.[0] ?? null)
    : null;

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
