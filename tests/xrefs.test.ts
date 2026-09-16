import assert from "node:assert/strict";
import { test } from "node:test";
import { expandXrefs, loadXrefs } from "../src/lib/xrefs.ts";
import type { Candidate } from "../src/lib/types.ts";

test("xrefs pack is a licensed starter set keyed by BSB ids", () => {
  const packed = loadXrefs();
  const keys = Object.keys(packed);
  assert.ok(keys.length > 100);
  assert.match(keys[0] ?? "", /^[A-Za-z0-9]+\.\d+\.\d+$/);
});

test("expandXrefs appends unseen targets after primary hits", () => {
  const packed = loadXrefs();
  const seedId = Object.keys(packed)[0];
  assert.ok(seedId);
  const seed: Candidate = {
    id: seedId,
    book: "Genesis",
    chapter: 1,
    verse: 1,
    text: "seed",
    displayRef: seedId,
    context: "",
    searchScore: 0.9,
  };
  const expanded = expandXrefs([seed], 1, 2);
  assert.ok(expanded.length >= 1);
  assert.equal(expanded[0]?.id, seedId);
});
