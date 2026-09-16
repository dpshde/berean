import assert from "node:assert/strict";
import { test } from "node:test";
import { loadVerses } from "../src/lib/bsb.ts";
import { retrieve, retrieveFrom } from "../src/lib/search.ts";
import type { Verse } from "../src/lib/types.ts";

const verses: Verse[] = [
  {
    id: "Gen.1.1",
    book: "Genesis",
    chapter: 1,
    verse: 1,
    text: "In the beginning God created the heavens and the earth.",
  },
  {
    id: "Jhn.1.1",
    book: "John",
    chapter: 1,
    verse: 1,
    text: "In the beginning was the Word, and the Word was with God, and the Word was God.",
  },
  {
    id: "Rom.3.23",
    book: "Romans",
    chapter: 3,
    verse: 23,
    text: "for all have sinned and fall short of the glory of God,",
  },
];

test("retrieves the verse that names the claim", () => {
  const hits = retrieveFrom(verses, "the Word was God");
  assert.equal(hits[0]?.id, "Jhn.1.1");
});

test("retrieves creation for a creation claim", () => {
  const hits = retrieveFrom(verses, "God created the heavens");
  assert.equal(hits[0]?.id, "Gen.1.1");
});

test("lexical recall finds many lust verses", () => {
  const hits = retrieve("lust", 80);
  assert.ok(hits.length > 3, `expected more than 3 hits, got ${hits.length}`);
});

test("packs the full BSB", () => {
  const all = loadVerses();
  assert.equal(all.length, 31086);
  assert.equal(all[0]?.id, "Gen.1.1");
  assert.equal(all.at(-1)?.id, "Rev.22.21");
});
