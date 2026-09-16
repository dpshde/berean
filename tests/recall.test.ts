import assert from "node:assert/strict";
import { test } from "node:test";
import { applyRerankScores, mergeRecall } from "../src/lib/recall.ts";
import type { Candidate } from "../src/lib/types.ts";

function candidate(id: string, searchScore: number): Candidate {
  return {
    id,
    book: "John",
    chapter: 1,
    verse: Number(id.split(".").at(-1)),
    text: id,
    displayRef: id,
    context: "",
    searchScore,
  };
}

test("mergeRecall keeps beam leaves and fills from lexical without dupes", () => {
  const beam = [candidate("John.1.1", 0.9)];
  const lexical = [candidate("John.1.1", 0.1), candidate("John.3.16", 0.8), candidate("Rom.6.12", 0.7)];
  const merged = mergeRecall(beam, lexical, 2);
  assert.deepEqual(
    merged.map((item) => item.id),
    ["John.1.1", "John.3.16"],
  );
});

test("applyRerankScores sorts by the Jev noul", () => {
  const ranked = applyRerankScores(
    [candidate("John.1.1", 0.1), candidate("John.3.16", 0.9)],
    [0.95, 0.2],
  );
  assert.equal(ranked[0]?.id, "John.1.1");
  assert.equal(ranked[0]?.searchScore, 0.95);
});
