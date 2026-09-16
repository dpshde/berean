import { displayRef, getVerseAt, loadVerses, neighborContext } from "./bsb.ts";
import { ROUTE_SLUGS } from "./route.ts";
import type { Candidate, Verse } from "./types.ts";

export type PassageRef = {
  book: string;
  chapter: number;
  verse: number;
  endVerse: number;
};

const BOOK_BY_KEY = new Map<string, string>();

function keyOf(value: string): string {
  return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, "");
}

function bookKeys(): Map<string, string> {
  if (BOOK_BY_KEY.size > 0) return BOOK_BY_KEY;
  const names = new Set(loadVerses().map((verse) => verse.book));
  for (const book of names) {
    BOOK_BY_KEY.set(keyOf(book), book);
    if (book === "Psalm") BOOK_BY_KEY.set("psalms", book);
    if (book === "Song Of Solomon") {
      BOOK_BY_KEY.set("songofsongs", book);
      BOOK_BY_KEY.set("song", book);
    }
  }
  for (const [book, slug] of Object.entries(ROUTE_SLUGS)) {
    if (names.has(book)) BOOK_BY_KEY.set(keyOf(slug), book);
  }
  const prefixes = new Map<string, string>();
  for (const verse of loadVerses()) {
    if (!prefixes.has(verse.book)) prefixes.set(verse.book, verse.id.split(".")[0] ?? "");
  }
  for (const [book, prefix] of prefixes) {
    BOOK_BY_KEY.set(keyOf(prefix), book);
  }
  return BOOK_BY_KEY;
}

export function resolveBook(name: string): string | undefined {
  return bookKeys().get(keyOf(name));
}

const PASSAGE =
  /^(?<book>.+?)\s+(?<chapter>\d+)\s*:\s*(?<verse>\d+)(?:\s*[-–—]\s*(?<end>\d+))?$/u;
const OSIS = /^(?<book>[A-Za-z0-9]+)[.\s]+(?<chapter>\d+)[.:]\s*(?<verse>\d+)(?:\s*[-–—]\s*(?<end>\d+))?$/u;

export function parsePassageQuery(query: string): PassageRef | undefined {
  const trimmed = query.trim();
  const match = PASSAGE.exec(trimmed) ?? OSIS.exec(trimmed);
  if (!match?.groups) return undefined;
  const book = resolveBook(match.groups.book ?? "");
  const chapter = Number(match.groups.chapter);
  const verse = Number(match.groups.verse);
  const endVerse = Number(match.groups.end ?? match.groups.verse);
  if (!book || !chapter || !verse || !endVerse || endVerse < verse) return undefined;
  return { book, chapter, verse, endVerse };
}

export function versesForPassage(ref: PassageRef): Verse[] {
  const verses: Verse[] = [];
  for (let number = ref.verse; number <= ref.endVerse; number += 1) {
    const verse = getVerseAt(ref.book, ref.chapter, number);
    if (verse) verses.push(verse);
  }
  return verses;
}

export function candidatesForPassage(ref: PassageRef): Candidate[] {
  return versesForPassage(ref).map((verse) => ({
    ...verse,
    displayRef: displayRef(verse),
    context: neighborContext(verse.id),
    searchScore: 1,
  }));
}
