import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const videosDir = path.resolve(__dirname, "public");
const outputDir = path.resolve(__dirname, "public/posters");

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function generatePoster(
  videoPath,
  outputPath,
  posterName,
  width,
  height,
) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .screenshots({
        count: 1,
        folder: outputPath,
        filename: posterName,
        size: `${width}x${height}`,
      })
      .on("end", resolve)
      .on("error", reject);
  });
}

function getVideoDimensions(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, { streams: true }, (err, metadata) => {
      if (err) {
        return reject(err);
      }

      // Look for the video stream, not audio or other streams
      const videoStream = metadata.streams.find(
        (stream) => stream.codec_type === "video",
      );

      if (!videoStream) {
        return reject(new Error("No video stream found"));
      }

      // Get the raw width and height
      let { width, height } = videoStream;

      // Check for display aspect ratio adjustments
      if (
        videoStream.display_aspect_ratio &&
        videoStream.display_aspect_ratio !== "0:1"
      ) {
        const displayAspect = videoStream.display_aspect_ratio
          .split(":")
          .map(Number);
        if (
          displayAspect.length === 2 &&
          !isNaN(displayAspect[0]) &&
          !isNaN(displayAspect[1])
        ) {
          const dar = displayAspect[0] / displayAspect[1];
          const par =
            videoStream.sample_aspect_ratio &&
            videoStream.sample_aspect_ratio !== "0:1" &&
            videoStream.sample_aspect_ratio !== "1:1"
              ? videoStream.sample_aspect_ratio
                  .split(":")
                  .map(Number)
                  .reduce((a, b) => a / b)
              : 1;

          // Adjust dimensions based on pixel aspect ratio
          if (par !== 1) {
            // If wider pixels, adjust width
            if (par > 1) {
              width = Math.round(width * par);
            }
            // If taller pixels, adjust height
            else if (par < 1) {
              height = Math.round(height / par);
            }
          }

          // As a fallback, try to calculate from DAR directly
          if (Math.abs(width / height - dar) > 0.05) {
            width = Math.round(height * dar);
          }
        }
      }

      // Check for rotation metadata
      const rotation =
        videoStream.tags &&
        (videoStream.tags.rotate ||
          videoStream.tags.rotation ||
          (videoStream.side_data_list &&
            videoStream.side_data_list.some(
              (data) => data.rotation !== undefined,
            )));

      // If rotated 90 or 270 degrees, swap width and height
      if (
        rotation === "90" ||
        rotation === "270" ||
        rotation === 90 ||
        rotation === 270
      ) {
        [width, height] = [height, width];
      }

      resolve({
        width,
        height,
        rawWidth: videoStream.width,
        rawHeight: videoStream.height,
      });
    });
  });
}

async function scanDirectory(dir) {
  let entries;
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch (err) {
    console.error(`Error reading ${dir}: ${err.message}`);
    return;
  }

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);

    if (entry.name === "posters" && dir === videosDir) continue;

    if (entry.isDirectory()) {
      await scanDirectory(entryPath);
    } else if (
      [".mp4", ".webm", ".mov"].includes(path.extname(entry.name).toLowerCase())
    ) {
      const relativePath = path.relative(videosDir, dir);
      const subOutputDir = relativePath
        ? path.join(outputDir, relativePath)
        : outputDir;
      if (!fs.existsSync(subOutputDir))
        fs.mkdirSync(subOutputDir, { recursive: true });

      const posterName = `${path.parse(entry.name).name}.jpg`;

      // Log the video dimensions
      try {
        const { width, height, rawWidth, rawHeight } =
          await getVideoDimensions(entryPath);
        console.log(`Video: ${entryPath}`);

        await generatePoster(
          entryPath,
          subOutputDir,
          posterName,
          width,
          height,
        );
        console.log(`✓ Poster created\n`);
      } catch (err) {
        console.error(`✗ Failed for: ${entry.name}`, err.message);
      }
    }
  }
}

(async () => {
  console.log("Scanning videos...");
  await scanDirectory(videosDir);
  console.log("Done.");
})();
