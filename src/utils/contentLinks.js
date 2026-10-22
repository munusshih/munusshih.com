// Verified replacement destinations. Apply after sheet loading so an older
// spreadsheet URL cannot reintroduce a broken link on the next deployment.
const replacements = [
  ['/work/p5-zine/', '/p5-zine/'],
  ['https://ccfest.rocks/march21-2026', 'https://saber-khan-hp7r.squarespace.com/march21-2026'],
  ['https://www.uaad.art/technomirage', 'https://www.garysguide.com/events/vlr4hjt/TechnoMirage'],
];

export function repairContentLinks(value) {
  if (typeof value === 'string') {
    for (const [oldUrl, newUrl] of replacements) value = value.replaceAll(oldUrl, newUrl);
    return value.replace(/https:\/\/www\.figma\.com\/proto\/JZCDRSr995rWYZfexwc0N5\/DragonBytes[^\s)"']*/g,
      'https://saber-khan-hp7r.squarespace.com/ccfestnycjan282024');
  }
  if (Array.isArray(value)) return value.map(repairContentLinks);
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, repairContentLinks(item)]),
  );
  return value;
}
