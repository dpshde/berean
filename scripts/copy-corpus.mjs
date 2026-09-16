import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const destDir = join(root, "dist", "data");
mkdirSync(destDir, { recursive: true });

for (const name of ["bsb.json", "xrefs.json", "topics.json"]) {
  const src = join(root, "data", name);
  if (!existsSync(src)) {
    if (name === "bsb.json") throw new Error(`Missing BSB corpus at ${src}`);
    continue;
  }
  const dest = join(destDir, name);
  cpSync(src, dest);
  console.log(`copied ${src} -> ${dest}`);
}
