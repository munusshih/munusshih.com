function cleanInput(value) {
  return String(value ?? "").trim();
}

export function normalizeMediaSrc(value) {
  const raw = cleanInput(value);
  if (!raw) return "";

  if (/^(https?:)?\/\//i.test(raw) || /^(data:|blob:)/i.test(raw)) {
    return raw;
  }

  if (raw.startsWith("/_astro/")) {
    return raw;
  }

  let path = raw.startsWith("/") ? raw : `/${raw}`;

  // Common bad content path seen in several MDX files.
  path = path.replace(/\/assets\/work\/assets\/work\//g, "/assets/work/");
  path = path.replace(/\/assets\/assets\//g, "/assets/");

  if (path.startsWith("/assets/")) {
    return path;
  }

  return `/assets${path}`;
}

export function posterFromMediaSrc(value) {
  const src = normalizeMediaSrc(value);
  if (!/\.(mp4|webm|ogg)(?:$|[?#])/i.test(src)) {
    return src;
  }

  const withJpg = src.replace(/\.(mp4|webm|ogg)(?=$|[?#])/i, ".jpg");

  if (withJpg.startsWith("/assets/work/")) {
    return withJpg.replace("/assets/work/", "/assets/posters/");
  }

  if (withJpg.startsWith("/assets/")) {
    return withJpg.replace("/assets/", "/assets/posters/");
  }

  return withJpg;
}
