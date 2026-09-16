import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { displayRef, getVerse, neighborContext } from "./bsb.ts";
import { XREF_PER_SEED, XREF_SEEDS } from "./recall.ts";
import type { Candidate } from "./types.ts";

const XREF_REL = join("data", "xrefs.json");
const MODULE_DIR = dirname(fileURLToPath(import.meta.url));

let packed: Record<string, string[]> | null = null;

function resolveXrefPath(): string | undefined {
  const envPath = process.env.XREF_PATH;
  const candidates = [
    envPath,
    join(process.cwd(), XREF_REL),
    join(MODULE_DIR, "..", "..", XREF_REL),
    join(MODULE_DIR, "..", "..", "..", XREF_REL),
  ].filter((path): path is string => Boolean(path));
  for (const path of candidates) {
    const absolute = resolve(path);
    if (existsSync(absolute)) return absolute;
  }
  return undefined;
}

export function loadXrefs(): Record<string, string[]> {
  if (packed) return packed;
  const path = resolveXrefPath();
  packed = path ? (JSON.parse(readFileSync(path, "utf8")) as Record<string, string[]>) : {};
  return packed;
}

export function xrefsFor(id: string): string[] {
  return loadXrefs()[id] ?? [];
}

/** Append licensed cross-refs for the top seeds. Already-ranked hits stay put. */
export function expandXrefs(
  primary: Candidate[],
  seeds = XREF_SEEDS,
  perSeed = XREF_PER_SEED,
): Candidate[] {
  const seen = new Set(primary.map((candidate) => candidate.id));
  const extra: Candidate[] = [];
  for (const seed of primary.slice(0, seeds)) {
    for (const id of xrefsFor(seed.id).slice(0, perSeed)) {
      if (seen.has(id)) continue;
      const verse = getVerse(id);
      if (!verse) continue;
      seen.add(id);
      extra.push({
        ...verse,
        displayRef: displayRef(verse),
        context: neighborContext(verse.id),
        searchScore: Math.min(seed.searchScore, 0.2),
      });
    }
  }
  return [...primary, ...extra];
}
