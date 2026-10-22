import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { findCachedMedia, normalizeCachedMedia } from './cachedMedia.js';
import { repairContentLinks } from '../src/utils/contentLinks.js';

test('cache rejects HTML error pages and corrects real image extensions', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'media-test-'));
  try {
    const file = path.join(dir, 'image.jpg');
    await fs.writeFile(file, '<html>404 Not found</html>');
    await assert.rejects(normalizeCachedMedia(file), /Not a supported/);
    await sharp({create:{width:2,height:2,channels:4,background:'#ff0000'}}).png().toFile(file);
    const result = await normalizeCachedMedia(file);
    assert.equal(result.path, path.join(dir, 'image.png'));
    assert.equal(result.contentType, 'image/png');
    assert.equal(await findCachedMedia(file), result.path);
  } finally { await fs.rm(dir, {recursive:true,force:true}); }
});

test('sheet link repairs handle nested entries and markdown', () => {
  const entry = {body:'See [p5.zine](/work/p5-zine/).', link:{href:'https://ccfest.rocks/march21-2026'}};
  assert.deepEqual(repairContentLinks(entry), {body:'See [p5.zine](/p5-zine/).', link:{href:'https://saber-khan-hp7r.squarespace.com/march21-2026'}});
  assert.equal(entry.link.href, 'https://ccfest.rocks/march21-2026');
});

test('checked-in teaching manifest refers to files with correct formats', async () => {
  const manifest = JSON.parse(await fs.readFile(new URL('../src/data/generated/teachingMedia.json', import.meta.url)));
  const { identifyMedia } = await import('./cachedMedia.js');
  for (const records of Object.values(manifest)) for (const record of records) {
    const file = new URL('../src/assets' + record.src, import.meta.url);
    const actual = await identifyMedia(fileURLToPath(file));
    assert.equal(path.extname(file.pathname), '.' + actual.extension, record.src);
    assert.equal(record.kind, actual.contentType.split('/')[0], record.src);
  }
});


test('spreadsheet status text is not a media URL', async () => {
  const { parseMediaSpec } = await import('./cacheTeachingMedia.js');
  assert.equal(parseMediaSpec('Upcoming', {}), null);
  assert.equal(parseMediaSpec('N/A', {}), null);
  assert.equal(parseMediaSpec('/assets/lab/howl.mp4', {}).mode, 'local');
  assert.equal(parseMediaSpec('[video] https://example.com/demo', {}).mode, 'video');
});
