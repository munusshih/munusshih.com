import fs from "fs";
import path from "path";
import { glob } from "glob";

const srcRoot = path.resolve("src/assets");
const destRoot = path.resolve("public/assets");

function copyAllAssets() {
  const files = glob.sync("**/*", { cwd: srcRoot, nodir: true });

  files.forEach((file) => {
    const src = path.join(srcRoot, file);
    const dest = path.join(destRoot, file);

    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  });

  console.log(`Synced ${files.length} asset(s) to public/assets`);
}

copyAllAssets();

