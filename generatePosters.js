import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get the current directory using import.meta.url with proper handling for macOS/Unix paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Correct the path to the public directory at the root of the project
const videosDir = path.resolve(__dirname, "public"); // Using resolve for absolute path
const outputDir = path.resolve(__dirname, "public/posters");

console.log("Videos directory path:", videosDir);
// console.log("Output directory path:", outputDir);

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
  console.log("Created output directory:", outputDir);
}

function getVideoDimensions(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        const { width, height } = metadata.streams[0];
        resolve({ width, height });
      }
    });
  });
}

// Function to generate poster image from video
async function generatePoster(videoPath, outputPath, posterName) {
  try {
    const { width, height } = await getVideoDimensions(videoPath); // Get video dimensions
    console.log(`Video dimensions: ${width}x${height}`);

    return new Promise((resolve, reject) => {
      console.log(`Generating poster for ${videoPath}`);
      console.log(`Output path: ${outputPath}, poster name: ${posterName}`);

      ffmpeg(videoPath)
        .screenshots({
          count: 1,
          folder: outputPath,
          size: `${width}x${height}`, // Set the poster size dynamically based on video size
          filename: posterName,
        })
        .on("end", resolve)
        .on("error", reject);
    });
  } catch (error) {
    console.error("Error getting video dimensions:", error);
    throw error;
  }
}

// Function to recursively scan the public directory for video files
async function scanDirectory(directory) {
  console.log(`\nScanning directory: ${directory}`);

  try {
    // Debug: Verify we can read this directory
    try {
      await fs.promises.access(directory, fs.constants.R_OK);
      console.log(`✓ Have read permissions for ${directory}`);
    } catch (err) {
      console.error(`✗ No read permissions for ${directory}:`, err.message);
      return;
    }

    // List directory contents with more detailed error handling
    let files;
    try {
      files = await fs.promises.readdir(directory, { withFileTypes: true });
      console.log(`Found ${files.length} entries in ${directory}`);
    } catch (err) {
      console.error(`Error reading directory ${directory}:`, err.message);
      return;
    }

    // List all subdirectories for debugging
    const directories = files
      .filter((file) => file.isDirectory())
      .map((file) => file.name);

    if (directories.length > 0) {
      console.log("Subdirectories found in", directory, ":");
      directories.forEach((dir) => console.log(` - ${dir}`));
    } else {
      console.log("No subdirectories found in", directory);
    }

    // Process all files and directories
    for (const file of files) {
      const filePath = path.join(directory, file.name);

      // Skip the output folder (posters)
      if (file.name === "posters" && directory === videosDir) {
        console.log(`Skipping output directory: ${filePath}`);
        continue;
      }

      if (file.isDirectory()) {
        console.log(`Found directory: ${filePath}`);
        // Recursively scan subdirectories
        await scanDirectory(filePath);
      } else if (
        [".mp4", ".webm", ".mov"].includes(
          path.extname(file.name).toLowerCase(),
        )
      ) {
        console.log(`Found video file: ${filePath}`);

        // Get the relative path from the public directory
        const relativePath = path.relative(videosDir, directory);

        // Create corresponding output directory for this subdirectory
        const subOutputDir = relativePath
          ? path.join(outputDir, relativePath)
          : outputDir;

        console.log(`Creating output directory: ${subOutputDir}`);

        if (!fs.existsSync(subOutputDir)) {
          fs.mkdirSync(subOutputDir, { recursive: true });
        }

        // Use the base filename for the poster
        const posterName = `${path.parse(file.name).name}.jpg`;

        try {
          await generatePoster(filePath, subOutputDir, posterName);
          console.log(`✓ Poster generated for ${file.name} in ${subOutputDir}`);
        } catch (error) {
          console.error(
            `✗ Error generating poster for ${file.name}:`,
            error.message,
          );
        }
      }
    }
  } catch (error) {
    console.error(
      `Fatal error scanning directory ${directory}:`,
      error.message,
    );
  }
}

// Print Node.js process information
console.log("Node.js version:", process.version);
console.log(
  "Process running as user:",
  process.getuid ? process.getuid() : "N/A",
);
console.log("Current working directory:", process.cwd());

// Start scanning the public directory
console.log("\n===== Starting video scan... =====");
scanDirectory(videosDir)
  .then(() => console.log("\n===== Finished processing all videos ====="))
  .catch((err) =>
    console.error(
      "\n===== Error during scanning and poster generation: =====",
      err,
    ),
  );
