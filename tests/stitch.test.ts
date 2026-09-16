import assert from "node:assert/strict";
import { test } from "node:test";
import { displayRangeRef } from "../src/lib/bsb.ts";
import { canStitch, stitchJudgments } from "../src/lib/stitch.ts";
import type { VerseJudgment } from "../src/lib/types.ts";

function judgment(
  overrides: Partial<VerseJudgment> & Pick<VerseJudgment, "id" | "book" | "chapter" | "verse" | "text">,
): VerseJudgment {
  return {
    displayRef: `${overrides.book} ${overrides.chapter}:${overrides.verse}`,
    relation: "supports",
    probabilities: { supports: 0.8, contradicts: 0.1, silent: 0.1 },
    confidence: 0.7,
    ...overrides,
  };
}

const john1 = judgment({
  id: "Jhn.1.1",
  book: "John",
  chapter: 1,
  verse: 1,
  text: "In the beginning was the Word, and the Word was with God, and the Word was God.",
  probabilities: { supports: 0.94, contradicts: 0.02, silent: 0.04 },
});

const john2 = judgment({
  id: "Jhn.1.2",
  book: "John",
  chapter: 1,
  verse: 2,
  text: "He was with God in the beginning.",
  probabilities: { supports: 0.7, contradicts: 0.1, silent: 0.2 },
});

const john3 = judgment({
  id: "Jhn.1.3",
  book: "John",
  chapter: 1,
  verse: 3,
  text: "Through Him all things were made, and without Him nothing was made that has been made.",
  probabilities: { supports: 0.6, contradicts: 0.1, silent: 0.3 },
});

const gen1 = judgment({
  id: "Gen.1.1",
  book: "Genesis",
  chapter: 1,
  verse: 1,
  text: "In the beginning God created the heavens and the earth.",
});

test("displayRangeRef keeps a single verse", () => {
  assert.equal(displayRangeRef(john1), "John 1:1");
  assert.equal(displayRangeRef(john1, john1), "John 1:1");
});

test("displayRangeRef joins a same-chapter span", () => {
  assert.equal(displayRangeRef(john1, john3), "John 1:1–3");
});

test("displayRangeRef does not invent a cross-chapter span", () => {
  assert.equal(
    displayRangeRef(john1, { book: "John", chapter: 2, verse: 1 }),
    "John 1:1",
  );
});

test("canStitch requires the next verse in the same chapter and relation", () => {
  assert.equal(canStitch(john1, john2), true);
  assert.equal(canStitch(john1, john3), false);
  assert.equal(canStitch(john1, gen1), false);
  assert.equal(
    canStitch(john1, { ...john2, relation: "contradicts" }),
    false,
  );
});

test("stitchJudgments leaves a lone verse unchanged", () => {
  const [stitched] = stitchJudgments([john1]);
  assert.equal(stitched?.id, "Jhn.1.1");
  assert.equal(stitched?.displayRef, "John 1:1");
  assert.equal(stitched?.text, john1.text);
});

test("stitchJudgments merges consecutive hits into one passage", () => {
  const [stitched] = stitchJudgments([john2, john1, john3], (item) => item.probabilities.supports);
  assert.equal(stitched?.displayRef, "John 1:1–3");
  assert.equal(stitched?.id, "Jhn.1.1-3");
  assert.equal(stitched?.text, `${john1.text} ${john2.text} ${john3.text}`);
  assert.equal(stitched?.probabilities.supports, 0.94);
  assert.equal(stitched?.verse, 1);
});

test("stitchJudgments breaks on a verse gap", () => {
  const result = stitchJudgments([john1, john3]);
  assert.deepEqual(
    result.map((item) => item.displayRef),
    ["John 1:1", "John 1:3"],
  );
});

test("stitchJudgments keeps different books apart", () => {
  const result = stitchJudgments([john1, gen1]);
  assert.equal(result.length, 2);
  assert.ok(result.some((item) => item.displayRef === "Genesis 1:1"));
  assert.ok(result.some((item) => item.displayRef === "John 1:1"));
});

test("stitchJudgments does not merge mixed relations", () => {
  const denied = { ...john2, relation: "contradicts" as const };
  const result = stitchJudgments([john1, denied]);
  assert.equal(result.length, 2);
  assert.equal(result[0]?.relation, "supports");
  assert.equal(result[1]?.relation, "contradicts");
});
