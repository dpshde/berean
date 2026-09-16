import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BEAM_WIDTH,
  EPSILON,
  beamSearch,
  extendCandidate,
  pathScore,
  pruneBeam,
  rootCandidate,
  type FrontierRequest,
} from "../src/lib/beam.ts";
import { buildCanon, childrenOf, formatPath, verseAt } from "../src/lib/canon.ts";
import type { CanonTree } from "../src/lib/canon.ts";

test("geometric-mean path score matches the cookbook", () => {
  assert.equal(pathScore(1, 0), 1);
  assert.equal(pathScore(0.36, 2), 0.6);
  assert.ok(Math.abs(pathScore(0.27, 2) - Math.sqrt(0.27)) < 1e-12);
});

test("single-child edges are not decisions", () => {
  const parent = {
    path: ["Obadiah"],
    probabilityProduct: 0.4,
    decisionCount: 1,
    score: 0.4,
  };
  const next = extendCandidate(parent, "1", { "1": 1 });
  assert.deepEqual(next.path, ["Obadiah", "1"]);
  assert.equal(next.probabilityProduct, 0.4);
  assert.equal(next.decisionCount, 1);
  assert.equal(next.score, 0.4);
});

test("zero-probability edges use EPSILON", () => {
  const next = extendCandidate(rootCandidate(), "X", { X: 0, Y: 1 });
  assert.equal(next.probabilityProduct, EPSILON);
  assert.equal(next.decisionCount, 1);
  assert.equal(next.score, EPSILON);
});

test("pruneBeam keeps the top K by score", () => {
  const kept = pruneBeam(
    [
      { path: ["a"], probabilityProduct: 0.1, decisionCount: 1, score: 0.1 },
      { path: ["b"], probabilityProduct: 0.9, decisionCount: 1, score: 0.9 },
      { path: ["c"], probabilityProduct: 0.4, decisionCount: 1, score: 0.4 },
      { path: ["d"], probabilityProduct: 0.7, decisionCount: 1, score: 0.7 },
    ],
    3,
  );
  assert.deepEqual(
    kept.map((candidate) => candidate.path[0]),
    ["b", "d", "c"],
  );
});

test("parallel beam recovers from a high-probability first book", async () => {
  const tree: CanonTree = {
    Wrong: { "2": { "2": {}, "1": {} }, "1": { "1": {}, "2": {} } },
    Right: { "1": { "1": {}, "2": {} }, "2": { "1": {}, "2": {} } },
    Other: { "1": { "1": {}, "2": {} }, "2": { "1": {}, "2": {} } },
  };

  const table: Record<string, Record<string, number>> = {
    "": { Wrong: 0.5, Right: 0.35, Other: 0.15 },
    Wrong: { "1": 0.3, "2": 0.7 },
    Right: { "1": 0.92, "2": 0.08 },
    Other: { "1": 0.5, "2": 0.5 },
    "Wrong 2": { "1": 0.8, "2": 0.2 },
    "Right 1": { "1": 0.97, "2": 0.03 },
    "Wrong 1": { "1": 0.5, "2": 0.5 },
    "Other 1": { "1": 0.5, "2": 0.5 },
    "Other 2": { "1": 0.5, "2": 0.5 },
    "Right 2": { "1": 0.5, "2": 0.5 },
  };

  const chooseFrontier = async (requests: FrontierRequest[]) =>
    requests.map((request) => {
      const key = formatPath(request.path);
      const probabilities = table[key === "Canon" ? "" : key];
      if (!probabilities) throw new Error(`missing fixture for ${key}`);
      return probabilities;
    });

  const result = await beamSearch(tree, chooseFrontier, { beamWidth: BEAM_WIDTH });
  assert.deepEqual(result.winner?.path, ["Right", "1", "1"]);
  assert.equal(result.retained[0]?.kind, "winner");
  assert.equal(result.retained[0]?.path, "Right 1:1");
  assert.ok(result.beam.length <= BEAM_WIDTH);
  assert.ok(result.beam.every((candidate) => candidate.path.length === 3));
});

test("canon children follow Book → Chapter → Verse", () => {
  const canon = buildCanon();
  const books = childrenOf(canon.tree, []);
  assert.ok(books.includes("Genesis"));
  assert.ok(books.includes("Revelation"));
  assert.deepEqual(childrenOf(canon.tree, ["Obadiah"]), ["1"]);
  assert.ok(childrenOf(canon.tree, ["John", "3"]).includes("16"));
  assert.equal(verseAt(canon, ["John", "3", "16"])?.id, "John.3.16");
  assert.equal(formatPath(["John", "3", "16"]), "John 3:16");
});
