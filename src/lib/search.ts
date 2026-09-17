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

const NUMBER_WORDS: Record<string, { cardinal: string; ordinal: string }> = {
  "1": { cardinal: "one", ordinal: "first" },
  "2": { cardinal: "two", ordinal: "second" },
  "3": { cardinal: "three", ordinal: "third" },
  "4": { cardinal: "four", ordinal: "fourth" },
  "5": { cardinal: "five", ordinal: "fifth" },
  "6": { cardinal: "six", ordinal: "sixth" },
  "7": { cardinal: "seven", ordinal: "seventh" },
  "8": { cardinal: "eight", ordinal: "eighth" },
  "9": { cardinal: "nine", ordinal: "ninth" },
  "10": { cardinal: "ten", ordinal: "tenth" },
  "11": { cardinal: "eleven", ordinal: "eleventh" },
  "12": { cardinal: "twelve", ordinal: "twelfth" },
};

function numberToken(): RegExp {
  return /\b(\d{1,2})(?:st|nd|rd|th)?\b/gi;
}

function significantTerms(claim: string): string[] {
  return claim
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !STOP.has(word));
}

/** Turn `4` / `4th` into separate `four` and `fourth` queries. MiniSearch drops bare digits. */
export function numericQueryVariants(claim: string): string[] {
  const variants = new Set<string>();
  const cardinal = claim.replace(numberToken(), (match, digits: string) => NUMBER_WORDS[digits]?.cardinal ?? match);
  const ordinal = claim.replace(numberToken(), (match, digits: string) => NUMBER_WORDS[digits]?.ordinal ?? match);
  if (cardinal !== claim) variants.add(cardinal);
  if (ordinal !== claim && ordinal !== cardinal) variants.add(ordinal);
  return [...variants];
}

function collectScores(mini: MiniSearch<Verse>, claim: string, scores: Map<string, number>): void {
  for (const variant of [claim, ...numericQueryVariants(claim)]) {
    for (const hit of mini.search(variant)) {
      scores.set(String(hit.id), Math.max(scores.get(String(hit.id)) ?? 0, hit.score));
    }
    const keyword = significantTerms(variant).join(" ");
    if (!keyword) continue;
    for (const hit of mini.search(keyword, { combineWith: "AND" })) {
      scores.set(String(hit.id), Math.max(scores.get(String(hit.id)) ?? 0, hit.score * 2));
    }
  }
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
    sourceScore: searchScore,
    lanes: ["lexical"],
  };
}

export function retrieve(claim: string, limit = SHORTLIST): Candidate[] {
  const scores = new Map<string, number>();
  collectScores(getIndex(), claim, scores);

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
  const scores = new Map<string, number>();
  collectScores(mini, claim, scores);
  const byId = new Map(verses.map((verse) => [verse.id, verse]));
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .flatMap(([id, searchScore]) => {
      const verse = byId.get(id);
      if (!verse) return [];
      return [
        {
          ...verse,
          displayRef: displayRef(verse),
          context: "",
          searchScore,
          sourceScore: searchScore,
          lanes: ["lexical"] as const,
        },
      ];
    });
}
