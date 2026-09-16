import { loadVerses } from "./bsb.ts";
import type { Verse } from "./types.ts";

export interface CanonTree {
  [label: string]: CanonTree;
}

export type Canon = {
  tree: CanonTree;
  byPath: Map<string, Verse>;
};

function verseKey(book: string, chapter: string, verse: string): string {
  return `${book}\u001f${chapter}\u001f${verse}`;
}

export function pathKey(path: readonly string[]): string {
  return path.join("\u001f");
}

export function buildCanon(verses: Verse[] = loadVerses()): Canon {
  const tree: CanonTree = {};
  const byPath = new Map<string, Verse>();

  for (const verse of verses) {
    const book = verse.book;
    const chapter = String(verse.chapter);
    const number = String(verse.verse);
    const bookNode = tree[book] ?? (tree[book] = {});
    const chapterNode = bookNode[chapter] ?? (bookNode[chapter] = {});
    chapterNode[number] = {};
    byPath.set(verseKey(book, chapter, number), verse);
  }

  return { tree, byPath };
}

export function childrenOf(tree: CanonTree, path: readonly string[]): string[] {
  let node: CanonTree = tree;
  for (const label of path) {
    const next = node[label];
    if (!next) return [];
    node = next;
  }
  return Object.keys(node);
}

export function verseAt(canon: Canon, path: readonly string[]): Verse | undefined {
  if (path.length !== 3) return undefined;
  const [book, chapter, verse] = path;
  if (!book || !chapter || !verse) return undefined;
  return canon.byPath.get(verseKey(book, chapter, verse));
}

export function formatPath(path: readonly string[]): string {
  if (path.length === 0) return "Canon";
  if (path.length === 1) return path[0] ?? "";
  if (path.length === 2) return `${path[0]} ${path[1]}`;
  return `${path[0]} ${path[1]}:${path[2]}`;
}
