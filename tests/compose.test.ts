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
  const result = composeVerdict("Is Jesus the Word of God?", [john, silent], {
    questionKind: "yes_no",
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
  assert.equal(result.questionKind, "yes_no");
  assert.equal(result.verdict, "yes");
  assert.equal(result.evidence[0]?.displayRef, "John 1:1");
  assert.deepEqual(result.beam, []);
});

test("composeVerdict keeps the zoom beam chips", () => {
  const beam = [{ path: "John 1:1", score: 0.8, kind: "winner" as const }];
  const result = composeVerdict(
    "Is Jesus the Word of God?",
    [john],
    {
      questionKind: "yes_no",
      supported: 0.91,
      denied: 0.08,
      relations: [
        {
          choice: "supports",
          probabilities: { supports: 0.94, contradicts: 0.02, silent: 0.04 },
          confidence: 0.9,
        },
      ],
    },
    beam,
  );
  assert.deepEqual(result.beam, beam);
});

test("no when scripture denies the claim", () => {
  const result = composeVerdict("Is there no God?", [john], {
    questionKind: "yes_no",
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

test("composeVerdict stitches consecutive same-relation verses", () => {
  const john2: Candidate = {
    id: "Jhn.1.2",
    book: "John",
    chapter: 1,
    verse: 2,
    text: "He was with God in the beginning.",
    displayRef: "John 1:2",
    context: "",
    searchScore: 0.8,
  };
  const result = composeVerdict("Is Jesus the Word of God?", [john, john2], {
    questionKind: "yes_no",
    supported: 0.91,
    denied: 0.08,
    relations: [
      {
        choice: "supports",
        probabilities: { supports: 0.94, contradicts: 0.02, silent: 0.04 },
        confidence: 0.9,
      },
      {
        choice: "supports",
        probabilities: { supports: 0.7, contradicts: 0.1, silent: 0.2 },
        confidence: 0.8,
      },
    ],
  });
  assert.equal(result.evidence.length, 1);
  assert.equal(result.evidence[0]?.displayRef, "John 1:1–2");
  assert.equal(
    result.evidence[0]?.text,
    `${john.text} ${john2.text}`,
  );
  assert.equal(result.evidence[0]?.relation, "supports");
});

test("no when support is below threshold", () => {
  const result = composeVerdict("Must Christians tithe exactly ten percent?", [silent], {
    questionKind: "yes_no",
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

test("free-form queries omit a yes/no even when support is high", () => {
  const result = composeVerdict("John 1:1", [john], {
    questionKind: "free_form",
    supported: 0.91,
    denied: 0.08,
    relations: [
      {
        choice: "supports",
        probabilities: { supports: 0.94, contradicts: 0.02, silent: 0.04 },
        confidence: 0.9,
      },
    ],
  });
  assert.equal(result.questionKind, "free_form");
  assert.equal(result.verdict, null);
  assert.equal(result.evidence[0]?.displayRef, "John 1:1");
});

test("free-form ranking uses beam score and keeps silent verses", () => {
  const result = composeVerdict("hope", [silent, john], {
    questionKind: "free_form",
    supported: 0.2,
    denied: 0.1,
    relations: [
      {
        choice: "silent",
        probabilities: { supports: 0.1, contradicts: 0.05, silent: 0.85 },
        confidence: 0.8,
      },
      {
        choice: "silent",
        probabilities: { supports: 0.1, contradicts: 0.05, silent: 0.85 },
        confidence: 0.8,
      },
    ],
  });
  assert.equal(result.verdict, null);
  assert.equal(result.evidence[0]?.id, "Jhn.1.1");
  assert.equal(result.evidence.length, 2);
});

test("incomplete Galatians 5:22 becomes 5:22–23 and does not keep a stub card", () => {
  const fruit: Candidate = {
    id: "Gal.5.22",
    book: "Galatians",
    chapter: 5,
    verse: 22,
    text: "But the fruit of the Spirit is love, joy, peace, patience, kindness, goodness, faithfulness,",
    displayRef: "Galatians 5:22",
    context: "",
    searchScore: 0.9,
  };
  const flesh: Candidate = {
    id: "Gal.6.8",
    book: "Galatians",
    chapter: 6,
    verse: 8,
    text: "The one who sows to please his flesh, from the flesh will reap destruction; but the one who sows to please the Spirit, from the Spirit will reap eternal life.",
    displayRef: "Galatians 6:8",
    context: "",
    searchScore: 0.4,
  };
  const result = composeVerdict("Fruits of the spirit", [fruit, flesh], {
    questionKind: "free_form",
    supported: 0.2,
    denied: 0.1,
    relations: [
      {
        choice: "silent",
        probabilities: { supports: 0.2, contradicts: 0.05, silent: 0.75 },
        confidence: 0.7,
      },
      {
        choice: "silent",
        probabilities: { supports: 0.1, contradicts: 0.05, silent: 0.85 },
        confidence: 0.7,
      },
    ],
  });
  const refs = result.evidence.map((item) => item.displayRef);
  assert.ok(refs.includes("Galatians 5:22–23"));
  assert.equal(refs.includes("Galatians 5:22"), false);
  assert.equal(refs.includes("Galatians 5:23"), false);
  const passage = result.evidence.find((item) => item.displayRef === "Galatians 5:22–23");
  assert.match(passage?.text ?? "", /faithfulness,/);
  assert.match(passage?.text ?? "", /self-control/);
});
