export function parseLooseDate(input) {
  let clean = String(input).trim().replace(",", "");

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
  let raw = String(input).trim().replace(",", "");

  // Save the original input for returning
  const originalInput = raw;

  // Handle "spring" as January and "fall" as August
  if (raw.toLowerCase().includes("spring")) {
    raw = raw.replace(/spring/i, "January");
  } else if (raw.toLowerCase().includes("fall")) {
    raw = raw.replace(/fall/i, "August");
  }

  const date = new Date(raw);
  if (isNaN(date)) return originalInput; // Return the original input if the date is invalid

  if (/^\d{4}$/.test(raw)) return date.getFullYear().toString();
  if (/^[A-Za-z]+\s+\d{4}$/.test(raw)) {
    // Return formatted string with the original term if it was 'spring' or 'fall'
    return originalInput.replace("spring", "January").replace("fall", "August");
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
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
    ); // notice b - a
}
