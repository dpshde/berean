import assert from "node:assert/strict";
import { test } from "node:test";
import { composeVerdict } from "../src/lib/compose.ts";
import type { Candidate } from "../src/lib/types.ts";

const john: Candidate = {
  id: "Jhn.1.1",
  book: "John",
  chapter: 1,
  verse: 1,
  text: "In the beginning was the Word, and the Word was with God, and the Word was God.",
  displayRef: "John 1:1",
  context: "",
  searchScore: 1,
};

const silent: Candidate = {
  id: "Gen.1.1",
  book: "Genesis",
  chapter: 1,
  verse: 1,
  text: "In the beginning God created the heavens and the earth.",
  displayRef: "Genesis 1:1",
  context: "",
  searchScore: 0.2,
};

test("yes when scripture supports the claim", () => {
  const result = composeVerdict("Jesus is the Word of God", [john, silent], {
    supported: 0.91,
    denied: 0.08,
    relations: [
      {
        choice: "supports",
        probabilities: { supports: 0.94, contradicts: 0.02, silent: 0.04 },
        confidence: 0.9,
      },
      {
        choice: "silent",
        probabilities: { supports: 0.1, contradicts: 0.05, silent: 0.85 },
        confidence: 0.8,
      },
    ],
  });
  assert.equal(result.verdict, "yes");
  assert.equal(result.evidence[0]?.displayRef, "John 1:1");
});

test("no when scripture denies the claim", () => {
  const result = composeVerdict("There is no God", [john], {
    supported: 0.04,
    denied: 0.88,
    relations: [
      {
        choice: "contradicts",
        probabilities: { supports: 0.02, contradicts: 0.9, silent: 0.08 },
        confidence: 0.88,
      },
    ],
  });
  assert.equal(result.verdict, "no");
  assert.equal(result.evidence[0]?.relation, "contradicts");
});

test("no when support is below threshold", () => {
  const result = composeVerdict("Christians must tithe exactly ten percent", [silent], {
    supported: 0.41,
    denied: 0.22,
    relations: [
      {
        choice: "silent",
        probabilities: { supports: 0.2, contradicts: 0.1, silent: 0.7 },
        confidence: 0.5,
      },
    ],
  });
  assert.equal(result.verdict, "no");
});
