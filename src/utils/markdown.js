import { marked } from "marked";
import { isExternalHttpHref } from "@/utils/externalLinks.js";

let configured = false;

function configureMarked() {
  if (configured) return;

  const baseRenderer = new marked.Renderer();
  const renderer = new marked.Renderer();

  renderer.link = function (...args) {
    const html = baseRenderer.link.apply(this, args);
    const firstArg = args[0];
    const href =
      firstArg && typeof firstArg === "object"
        ? firstArg.href || ""
        : typeof firstArg === "string"
          ? firstArg
          : "";

    if (!isExternalHttpHref(href)) return html;
    if (/\starget\s*=/.test(html)) return html;
    return html.replace(
      /^<a\s+/,
      '<a target="_blank" rel="noopener noreferrer" ',
    );
  };

  marked.use({
    breaks: true,
    gfm: true,
    renderer,
  });

  configured = true;
}

export function parseMarkdown(text, options = {}) {
  if (!text || typeof text !== "string") return "";
  configureMarked();
  return marked.parse(text.trim(), options);
}

export function parseMarkdownInline(text, options = {}) {
  if (!text || typeof text !== "string") return "";
  configureMarked();
  return marked.parseInline(text.trim(), options);
}

export function markdownToHtml(text) {
  const html = parseMarkdown(text);
  if (!html) return "";
  return html.replace(/^<p>(.*)<\/p>\s*$/s, "$1");
}
