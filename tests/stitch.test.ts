import assert from "node:assert/strict";
import { test } from "node:test";
import { displayRangeRef } from "../src/lib/bsb.ts";
import {
  canStitch,
  completeIncompletePassages,
  dropCoveredPassages,
  isIncompleteVerseText,
  stitchJudgments,
} from "../src/lib/stitch.ts";
import type { VerseJudgment } from "../src/lib/types.ts";

function judgment(
  overrides: Partial<VerseJudgment> & Pick<VerseJudgment, "id" | "book" | "chapter" | "verse" | "text">,
): VerseJudgment {
  return {
    displayRef: `${overrides.book} ${overrides.chapter}:${overrides.verse}`,
    relation: "supports",
    probabilities: { supports: 0.8, contradicts: 0.1, silent: 0.1 },
    confidence: 0.7,
    searchScore: 0,
    endVerse: overrides.endVerse ?? overrides.verse,
    href: `https://route.bible/x.${overrides.chapter}.${overrides.verse}`,
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

test("stitchJudgments can ignore relation for free-form passages", () => {
  const denied = { ...john2, relation: "contradicts" as const };
  const [stitched] = stitchJudgments([john1, denied], () => 0, { requireSameRelation: false });
  assert.equal(stitched?.displayRef, "John 1:1–2");
});

test("isIncompleteVerseText treats a trailing comma as unfinished", () => {
  assert.equal(
    isIncompleteVerseText("But the fruit of the Spirit is love, joy, peace, patience, kindness, goodness, faithfulness,"),
    true,
  );
  assert.equal(isIncompleteVerseText("gentleness, and self-control. Against such things there is no law."), false);
  assert.equal(isIncompleteVerseText("I and the Father are one.”"), false);
  assert.equal(isIncompleteVerseText("In the beginning God created the heavens and the earth."), false);
});

test("completeIncompletePassages pulls the next same-chapter verse", () => {
  const gal522 = judgment({
    id: "Gal.5.22",
    book: "Galatians",
    chapter: 5,
    verse: 22,
    text: "But the fruit of the Spirit is love, joy, peace, patience, kindness, goodness, faithfulness,",
  });
  const [completed] = completeIncompletePassages([gal522]);
  assert.equal(completed?.displayRef, "Galatians 5:22–23");
  assert.equal(completed?.endVerse, 23);
  assert.match(completed?.text ?? "", /self-control/);
});

test("completeIncompletePassages does not cross a chapter boundary", () => {
  const last = judgment({
    id: "Jhn.1.51",
    book: "MissingBook",
    chapter: 1,
    verse: 51,
    text: "and the angels of God ascending and descending on the Son of Man,",
  });
  const [completed] = completeIncompletePassages([last], () => undefined);
  assert.equal(completed?.displayRef, "MissingBook 1:51");
  assert.equal(completed?.endVerse, 51);
});

test("dropCoveredPassages removes a continuation that is already inside the range", () => {
  const span = judgment({
    id: "Gal.5.22-23",
    book: "Galatians",
    chapter: 5,
    verse: 22,
    endVerse: 23,
    text: "fruit list",
    displayRef: "Galatians 5:22–23",
  });
  const tail = judgment({
    id: "Gal.5.23",
    book: "Galatians",
    chapter: 5,
    verse: 23,
    text: "gentleness, and self-control. Against such things there is no law.",
  });
  const kept = dropCoveredPassages([span, tail]);
  assert.equal(kept.length, 1);
  assert.equal(kept[0]?.displayRef, "Galatians 5:22–23");
});
