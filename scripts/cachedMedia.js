import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const extensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg', 'mp4', 'webm', 'ogg'];

export async function findCachedMedia(destination) {
  const stem = destination.slice(0, -path.extname(destination).length);
  for (const candidate of [destination, ...extensions.map(ext => `${stem}.${ext}`)]) {
    try {
      if ((await fs.stat(candidate)).size > 0) return candidate;
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}

// Inspect bytes, not URLs: Drive and image proxies often omit the real format.
export async function identifyMedia(file) {
  const handle = await fs.open(file, 'r');
  const header = Buffer.alloc(32);
  try { await handle.read(header, 0, 32, 0); } finally { await handle.close(); }
  if (header.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return { extension: 'webm', contentType: 'video/webm' };
  if (header.toString('ascii', 0, 4) === 'OggS') return { extension: 'ogg', contentType: 'video/ogg' };
  // AVIF also uses ftyp, so try image decoding before identifying MP4.
  try {
    const info = await sharp(file).metadata();
    const extension = { jpeg: 'jpg', heif: 'avif' }[info.format] || info.format;
    if (extensions.includes(extension)) return { extension, contentType: `image/${extension === 'jpg' ? 'jpeg' : extension}` };
  } catch {}
  if (header.toString('ascii', 4, 8) === 'ftyp') return { extension: 'mp4', contentType: 'video/mp4' };
  throw new Error(`Not a supported image or video: ${file}`);
}

export async function normalizeCachedMedia(file) {
  const { extension, contentType } = await identifyMedia(file);
  const destination = file.slice(0, -path.extname(file).length) + '.' + extension;
  if (destination !== file) await fs.rename(file, destination);
  return { path: destination, contentType };
}
