import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyExists,
  chapterFindDistribution,
  chapterFindQuestions,
  lineCriteria,
  passageField,
  tagChapter,
  verseLineId,
} from "../src/lib/semantic-find.ts";

test("verseLineId pads to three digits", () => {
  assert.equal(verseLineId(1), "v001");
  assert.equal(verseLineId("16"), "v016");
  assert.equal(verseLineId(176), "v176");
});

test("tagChapter prefixes each verse with its line id", () => {
  assert.equal(
    tagChapter([
      { verse: 16, text: "For God so loved the world." },
      { verse: 17, text: "For God did not send His Son." },
    ]),
    "v016| For God so loved the world.\nv017| For God did not send His Son.",
  );
});

test("applyExists scales every option and ignores a missing noul", () => {
  const probabilities = { "16": 0.9, "17": 0.1 };
  assert.deepEqual(applyExists(probabilities, 0.5), { "16": 0.45, "17": 0.05 });
  assert.deepEqual(applyExists(probabilities, 0), { "16": 0, "17": 0 });
  assert.deepEqual(applyExists(probabilities, undefined), probabilities);
});

test("chapterFindQuestions asks where and exists over the tagged passage", () => {
  const questions = chapterFindQuestions(0, ["16", "17"]);
  assert.equal(questions.where_0?.type, "choice");
  assert.equal(questions.exists_0?.type, "noul");
  assert.deepEqual(lineCriteria(["16", "17"]), { v016: null, v017: null });
  assert.equal(passageField(2), "p2");
});

test("chapterFindDistribution maps line ids back to verse labels and gates them", () => {
  const distribution = chapterFindDistribution(
    ["16", "17"],
    { type: "choice", probabilities: { v016: 0.8, v017: 0.2 } },
    { type: "noul", noul: 0.5 },
  );
  assert.deepEqual(distribution, { "16": 0.4, "17": 0.1 });
});
