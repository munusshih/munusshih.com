import { SITE_URL } from "@/consts";

const DEFAULT_ORIGIN = (() => {
  try {
    return new URL(SITE_URL).origin;
  } catch (_error) {
    return "https://munusshih.com";
  }
})();

export function isExternalHttpHref(href, baseOrigin = DEFAULT_ORIGIN) {
  if (!href || typeof href !== "string") return false;
  if (href.startsWith("#")) return false;

  let parsed;
  try {
    parsed = new URL(href, baseOrigin);
  } catch (_error) {
    return false;
  }

  if (!["http:", "https:"].includes(parsed.protocol)) return false;
  return parsed.origin !== new URL(baseOrigin).origin;
}

export function externalLinkAttrs(href, baseOrigin = DEFAULT_ORIGIN) {
  return isExternalHttpHref(href, baseOrigin)
    ? { target: "_blank", rel: "noopener noreferrer" }
    : {};
}
