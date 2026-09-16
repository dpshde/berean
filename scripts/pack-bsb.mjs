import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src =
  process.argv[2] ??
  join(root, "../selah-tools/labs/route-bible-raycast/assets/bsb.jsonl");

const verses = [];
for (const line of readFileSync(src, "utf8").split("\n")) {
  if (!line.trim()) continue;
  const row = JSON.parse(line);
  verses.push({
    id: row.ref,
    book: row.book,
    chapter: Number.parseInt(String(row.chapter), 10),
    verse: Number.parseInt(String(row.verseNum ?? row.verse), 10),
    text: row.text,
  });
}

writeFileSync(join(root, "data/bsb.json"), JSON.stringify(verses));
console.log(`packed ${verses.length} BSB verses`);
