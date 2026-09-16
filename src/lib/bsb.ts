import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Verse } from "./types.ts";

const DATA = join(dirname(fileURLToPath(import.meta.url)), "../../data/bsb.json");

let verses: Verse[] | null = null;
let byId: Map<string, number> | null = null;

export function loadVerses(): Verse[] {
  if (!verses) {
    verses = JSON.parse(readFileSync(DATA, "utf8")) as Verse[];
    byId = new Map(verses.map((verse, index) => [verse.id, index]));
  }
  return verses;
}

export function displayRef(verse: Pick<Verse, "book" | "chapter" | "verse">): string {
  return `${verse.book} ${verse.chapter}:${verse.verse}`;
}

export function getVerse(id: string): Verse | undefined {
  const all = loadVerses();
  const index = byId?.get(id);
  return index == null ? undefined : all[index];
}

export function neighborContext(id: string): string {
  const all = loadVerses();
  const index = byId?.get(id);
  if (index == null) return "";
  const parts: string[] = [];
  const prev = all[index - 1];
  const next = all[index + 1];
  if (prev && prev.book === all[index]?.book && prev.chapter === all[index]?.chapter) {
    parts.push(`${displayRef(prev)} ${prev.text}`);
  }
  if (next && next.book === all[index]?.book && next.chapter === all[index]?.chapter) {
    parts.push(`${displayRef(next)} ${next.text}`);
  }
  return parts.join(" ");
}
