import { marked } from 'marked';

// Configure marked for inline markdown processing
marked.use({
  breaks: true,
  gfm: true
});

/**
 * Convert markdown text to HTML, suitable for inline use
 * @param {string} text - The markdown text to convert
 * @returns {string} - HTML string
 */
export function markdownToHtml(text) {
  if (!text || typeof text !== 'string') return '';
  
  // Process the markdown
  const html = marked.parse(text.trim());
  
  // Remove wrapping paragraph tags for inline use
  return html.replace(/^<p>(.*)<\/p>$/s, '$1');
}