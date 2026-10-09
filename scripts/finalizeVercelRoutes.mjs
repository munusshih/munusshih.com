import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { CANONICAL_ORIGIN } from '../src/utils/seo.js';

export function withSeoRoutes(config) {
  const seoRoutes = [
    { src: '^/.*$', has: [{ type: 'host', value: '.*\\.vercel\\.app' }], headers: { 'X-Robots-Tag': 'noindex, follow' }, continue: true },
    { src: '^/(?:Home|home)/?$', headers: { Location: CANONICAL_ORIGIN + '/' }, status: 308, caseSensitive: true },
    ...['www.munusshih.com', 'munusshih-com.vercel.app'].map(host => ({ src: '^/(.*)$', has: [{ type: 'host', value: host }], headers: { Location: CANONICAL_ORIGIN + '/$1' }, status: 308 })),
  ];
  const rules = new Set(seoRoutes.map(route => JSON.stringify(route)));
  const existing = (config.routes || []).filter(route => !rules.has(JSON.stringify(route)));
  return { ...config, routes: [...seoRoutes, ...existing] };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const configPath = new URL('../.vercel/output/config.json', import.meta.url);
  const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
  await fs.writeFile(configPath, JSON.stringify(withSeoRoutes(config), null, 2) + '\n');
}
