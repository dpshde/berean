import assert from "node:assert/strict";
import { test } from "node:test";
import { candidatesForPassage, parsePassageQuery } from "../src/lib/lookup.ts";

test("parsePassageQuery reads common BCV and OSIS forms", () => {
  assert.deepEqual(parsePassageQuery("John 3:16"), {
    book: "John",
    chapter: 3,
    verse: 16,
    endVerse: 16,
  });
  assert.deepEqual(parsePassageQuery("John 3:16-18"), {
    book: "John",
    chapter: 3,
    verse: 16,
    endVerse: 18,
  });
  assert.deepEqual(parsePassageQuery("1co.6.18"), {
    book: "1 Corinthians",
    chapter: 6,
    verse: 18,
    endVerse: 18,
  });
  assert.deepEqual(parsePassageQuery("1CO.13.4-8"), {
    book: "1 Corinthians",
    chapter: 13,
    verse: 4,
    endVerse: 8,
  });
  assert.equal(parsePassageQuery("lust"), undefined);
});

test("candidatesForPassage loads the BSB range", () => {
  const verses = candidatesForPassage({ book: "John", chapter: 3, verse: 16, endVerse: 17 });
  assert.equal(verses.length, 2);
  assert.equal(verses[0]?.id, "John.3.16");
});
