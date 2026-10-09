import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import sharp from "sharp";
import ffprobe from "ffprobe-static";

const metadata = new Map();

export function localMediaPath(src) {
  if (!src?.startsWith("/") || src.startsWith("//")) return undefined;
  const clean = decodeURIComponent(src.split(/[?#]/)[0]);
  for (const candidate of [path.join(process.cwd(), "public", clean), path.join(process.cwd(), "src", clean)]) {
    if (existsSync(candidate)) return candidate;
  }
}

export async function mediaDimensions(src, isVideo = false) {
  if (metadata.has(src)) return metadata.get(src);
  const pending = (async () => {
    const file = localMediaPath(src);
    if (!file) return {};
    try {
      if (isVideo) {
        const result = spawnSync(ffprobe.path, ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "json", file], { encoding: "utf8", timeout: 5000 });
        const stream = JSON.parse(result.stdout).streams?.[0];
        return stream?.width && stream?.height ? { width: stream.width, height: stream.height } : {};
      }
      const info = await sharp(file).metadata();
      const rotated = [5, 6, 7, 8].includes(info.orientation);
      return info.width && info.height ? { width: rotated ? info.height : info.width, height: rotated ? info.width : info.height } : {};
    } catch {
      return {};
    }
  })();
  metadata.set(src, pending);
  return pending;
}
