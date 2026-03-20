import fs from "fs";
import path from "path";

const srcRoot = path.resolve("src/assets");
const publicRoot = path.resolve("public");
const destAssets = path.join(publicRoot, "assets");
const legacyStaticRoot = path.resolve("src/static");
const legacyStaticAssets = path.join(legacyStaticRoot, "assets");

function ensureAssetsSymlink() {
  if (!fs.existsSync(srcRoot)) {
    throw new Error(`Missing source assets directory: ${srcRoot}`);
  }

  if (fs.existsSync(legacyStaticAssets)) {
    fs.rmSync(legacyStaticAssets, { recursive: true, force: true });
    console.log("Removed legacy src/static/assets");
  }

  if (fs.existsSync(legacyStaticRoot)) {
    const entries = fs.readdirSync(legacyStaticRoot);
    if (entries.length === 0) {
      fs.rmdirSync(legacyStaticRoot);
      console.log("Removed empty legacy src/static/");
    }
  }

  fs.mkdirSync(publicRoot, { recursive: true });

  if (fs.existsSync(destAssets)) {
    const stat = fs.lstatSync(destAssets);
    if (stat.isSymbolicLink()) {
      const currentTarget = fs.readlinkSync(destAssets);
      const resolvedTarget = path.resolve(path.dirname(destAssets), currentTarget);
      if (resolvedTarget === srcRoot) {
        console.log("public/assets already linked to src/assets");
        return;
      }
    }
    fs.rmSync(destAssets, { recursive: true, force: true });
  }

  const relativeTarget = path.relative(path.dirname(destAssets), srcRoot) || ".";
  fs.symlinkSync(relativeTarget, destAssets, "dir");
  console.log(`Linked public/assets -> ${relativeTarget}`);
}

ensureAssetsSymlink();
