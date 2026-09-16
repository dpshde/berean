import assert from "node:assert/strict";
import { test } from "node:test";
import {
  asQuestionKind,
  buildQuestions,
  buildRerankQuestions,
  QUESTION_KIND_CONFIDENCE,
  rerankScores,
} from "../src/lib/questions.ts";
import type { Candidate } from "../src/lib/types.ts";

const john: Candidate = {
  id: "Jhn.1.1",
  book: "John",
  chapter: 1,
  verse: 1,
  text: "In the beginning was the Word.",
  displayRef: "John 1:1",
  context: "",
  searchScore: 1,
};

test("asQuestionKind keeps a confident polar question", () => {
  assert.equal(asQuestionKind({ choice: "yes_no", confidence: 0.9 }), "yes_no");
});

test("asQuestionKind falls back to free-form when unsure", () => {
  assert.equal(asQuestionKind({ choice: "yes_no", confidence: QUESTION_KIND_CONFIDENCE - 0.01 }), "free_form");
  assert.equal(asQuestionKind({ choice: "free_form", confidence: 0.99 }), "free_form");
  assert.equal(asQuestionKind(undefined), "free_form");
});

test("buildQuestions asks question_kind in the same request", () => {
  const questions = buildQuestions([john]);
  assert.equal(questions.question_kind?.type, "choice");
  assert.equal(questions.supported?.type, "noul");
  assert.equal(questions.rel_0?.type, "choice");
});

test("buildRerankQuestions asks one noul per shortlist verse", () => {
  const questions = buildRerankQuestions([john]);
  assert.equal(questions.rank_0?.type, "noul");
  assert.deepEqual(rerankScores({ rank_0: { type: "noul", noul: 0.8 } }, 1), [0.8]);
});
