export const CANONICAL_ORIGIN = "https://www.munusshih.com";

export function canonicalUrl(pathname) {
  const path = pathname.replace(/\/+$/, "") || "/";
  return new URL(path, CANONICAL_ORIGIN).href;
}

export function isIndexablePath(pathname) {
  const path = pathname.replace(/\/+$/, "") || "/";
  return !["/404", "/404.html", "/500", "/calendar", "/sketches/pattern"].includes(path)
    && !path.startsWith("/api/");
}

export function isPreviewDeployment(env = process.env) {
  return env.VERCEL_ENV === "preview";
}
