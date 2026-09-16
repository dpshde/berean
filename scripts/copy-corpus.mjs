import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "data", "bsb.json");
const destDir = join(root, "dist", "data");
const dest = join(destDir, "bsb.json");

if (!existsSync(src)) {
  throw new Error(`Missing BSB corpus at ${src}`);
}

mkdirSync(destDir, { recursive: true });
cpSync(src, dest);
console.log(`copied ${src} -> ${dest}`);
