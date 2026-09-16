import MiniSearch from "minisearch";
import { displayRef, getVerse, loadVerses, neighborContext } from "./bsb.ts";
import { LEXICAL_LIMIT } from "./recall.ts";
import type { Candidate, Verse } from "./types.ts";

const SHORTLIST = LEXICAL_LIMIT;

const STOP = new Set([
  "the",
  "a",
  "an",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "to",
  "of",
  "and",
  "or",
  "not",
  "no",
  "in",
  "on",
  "for",
  "that",
  "this",
  "with",
  "by",
  "from",
  "as",
  "it",
  "if",
  "do",
  "does",
  "did",
  "there",
]);

let index: MiniSearch<Verse> | null = null;

function significantTerms(claim: string): string[] {
  return claim
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !STOP.has(word));
}

function getIndex(): MiniSearch<Verse> {
  if (index) return index;
  const mini = new MiniSearch<Verse>({
    fields: ["text", "book"],
    storeFields: ["id", "book", "chapter", "verse", "text"],
    idField: "id",
    searchOptions: {
      boost: { text: 3, book: 1 },
      fuzzy: 0.15,
      prefix: true,
    },
  });
  mini.addAll(loadVerses());
  index = mini;
  return mini;
}

function toCandidate(id: string, searchScore: number): Candidate | null {
  const verse = getVerse(id);
  if (!verse) return null;
  return {
    ...verse,
    displayRef: displayRef(verse),
    context: neighborContext(verse.id),
    searchScore,
  };
}

export function retrieve(claim: string, limit = SHORTLIST): Candidate[] {
  const mini = getIndex();
  const terms = significantTerms(claim);
  const keyword = terms.join(" ");
  const scores = new Map<string, number>();

  for (const hit of mini.search(claim)) {
    scores.set(String(hit.id), hit.score);
  }
  if (keyword) {
    for (const hit of mini.search(keyword, { combineWith: "AND" })) {
      scores.set(String(hit.id), Math.max(scores.get(String(hit.id)) ?? 0, hit.score * 2));
    }
  }

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .flatMap(([id, searchScore]) => {
      const candidate = toCandidate(id, searchScore);
      return candidate ? [candidate] : [];
    });
}

export function retrieveFrom(
  verses: Verse[],
  claim: string,
  limit = SHORTLIST,
): Candidate[] {
  const mini = new MiniSearch<Verse>({
    fields: ["text", "book"],
    storeFields: ["id", "book", "chapter", "verse", "text"],
    idField: "id",
  });
  mini.addAll(verses);
  return mini.search(claim).slice(0, limit).map((hit) => {
    const verse = hit as unknown as Verse;
    return {
      ...verse,
      displayRef: displayRef(verse),
      context: "",
      searchScore: hit.score,
    };
  });
}
