import assert from "node:assert/strict";
import { test } from "node:test";
import { applyRerankScores, mergeRecall } from "../src/lib/recall.ts";
import type { Candidate } from "../src/lib/types.ts";

function candidate(id: string, searchScore: number, lanes: Candidate["lanes"] = []): Candidate {
  return {
    id,
    book: "John",
    chapter: 1,
    verse: Number(id.split(".").at(-1)),
    text: id,
    displayRef: id,
    context: "",
    searchScore,
    sourceScore: searchScore,
    lanes,
  };
}

test("mergeRecall keeps best sourceScore and unions lane tags", () => {
  const beam = [candidate("John.1.1", 0.4, ["beam"])];
  const lexical = [candidate("John.1.1", 0.1, ["lexical"]), candidate("John.3.16", 0.8, ["lexical"])];
  const topical = [candidate("John.1.1", 0.95, ["topical"]), candidate("Rom.6.12", 0.7, ["topical"])];
  const merged = mergeRecall({ beam, lexical, topical }, 10);
  const john = merged.find((item) => item.id === "John.1.1");
  assert.ok(john);
  assert.ok(john.lanes?.includes("beam"));
  assert.ok(john.lanes?.includes("lexical"));
  assert.ok(john.lanes?.includes("topical"));
  assert.ok((john.sourceScore ?? 0) >= 0.9);
  assert.deepEqual(
    merged.map((item) => item.id).sort(),
    ["John.1.1", "John.3.16", "Rom.6.12"],
  );
});

test("mergeRecall caps after scoring so topical seeds are not dropped first", () => {
  const lexical = [candidate("John.1.2", 0.2, ["lexical"])];
  const topical = [candidate("John.3.16", 1, ["topical"])];
  const merged = mergeRecall({ lexical, topical }, 1);
  assert.equal(merged[0]?.id, "John.3.16");
  assert.ok(merged[0]?.lanes?.includes("topical"));
});

test("applyRerankScores sorts by the Jev noul", () => {
  const ranked = applyRerankScores(
    [candidate("John.1.1", 0.1), candidate("John.3.16", 0.9)],
    [0.95, 0.2],
  );
  assert.equal(ranked[0]?.id, "John.1.1");
  assert.equal(ranked[0]?.searchScore, 0.95);
});
