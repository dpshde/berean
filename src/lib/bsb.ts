import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Verse } from "./types.ts";

const CORPUS_REL = join("data", "bsb.json");
const MODULE_DIR = dirname(fileURLToPath(import.meta.url));

export type CorpusResolveOptions = {
  cwd?: string;
  moduleDir?: string;
  envPath?: string | undefined;
};

/**
 * Candidate locations for the packed BSB. After `@astrojs/node` builds,
 * this module lives under `dist/` (often `dist/server/chunks`), so a
 * `../../data/bsb.json` hop from `import.meta.url` lands on
 * `dist/data/bsb.json` while the corpus stays at `<cwd>/data/bsb.json`.
 */
export function corpusCandidates(options: CorpusResolveOptions = {}): string[] {
  const cwd = options.cwd ?? process.cwd();
  const moduleDir = options.moduleDir ?? MODULE_DIR;
  const envPath = options.envPath === undefined ? process.env.BSB_PATH : options.envPath;
  const seen = new Set<string>();
  const candidates: string[] = [];

  const add = (path: string) => {
    const absolute = resolve(path);
    if (seen.has(absolute)) return;
    seen.add(absolute);
    candidates.push(absolute);
  };

  if (envPath) add(envPath);
  add(join(cwd, CORPUS_REL));

  let dir = resolve(moduleDir);
  for (let i = 0; i < 8; i += 1) {
    add(join(dir, CORPUS_REL));
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return candidates;
}

export function resolveCorpusPath(options: CorpusResolveOptions = {}): string {
  const candidates = corpusCandidates(options);
  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  throw new Error(`BSB corpus not found. Tried: ${candidates.join(", ")}`);
}

let verses: Verse[] | null = null;
let byId: Map<string, number> | null = null;

export function loadVerses(): Verse[] {
  if (!verses) {
    verses = JSON.parse(readFileSync(resolveCorpusPath(), "utf8")) as Verse[];
    byId = new Map(verses.map((verse, index) => [verse.id, index]));
  }
  return verses;
}

export function displayRef(verse: Pick<Verse, "book" | "chapter" | "verse">): string {
  return `${verse.book} ${verse.chapter}:${verse.verse}`;
}

/** Range citation: `John 3:16` or `John 3:16–18`. Same-chapter only. */
export function displayRangeRef(
  start: Pick<Verse, "book" | "chapter" | "verse">,
  end: Pick<Verse, "book" | "chapter" | "verse"> = start,
): string {
  if (start.book !== end.book || start.chapter !== end.chapter || start.verse === end.verse) {
    return displayRef(start);
  }
  return `${start.book} ${start.chapter}:${start.verse}–${end.verse}`;
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
