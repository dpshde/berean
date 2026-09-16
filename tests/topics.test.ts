import assert from "node:assert/strict";
import { test } from "node:test";
import { retrieve } from "../src/lib/search.ts";
import {
  expandOsisSeed,
  getPassageCandidates,
  searchTopics,
  topicMatchScore,
} from "../src/lib/topics.ts";

test("searchTopics matches lust by slug and related keywords", () => {
  const hits = searchTopics("lust");
  assert.equal(hits[0]?.slug, "lust");
  assert.ok((hits[0]?.matchScore ?? 0) >= 0.9);
  assert.equal(searchTopics("sexual immorality")[0]?.slug, "lust");
  assert.equal(searchTopics("xyzzy-not-a-topic").length, 0);
});

test("searchTopics matches love without treating it as BSB keyword search", () => {
  const hits = searchTopics("love");
  assert.equal(hits[0]?.slug, "love");
  assert.ok(hits[0]?.seeds.some((seed) => seed.osis === "1CO.13.4-8"));
});

test("expandOsisSeed turns 1CO.13.4-8 into five BSB verses", () => {
  const verses = expandOsisSeed("1CO.13.4-8", 7);
  assert.equal(verses.length, 5);
  assert.equal(verses[0]?.id, "1Cor.13.4");
  assert.equal(verses.at(-1)?.id, "1Cor.13.8");
  assert.ok(verses.every((verse) => verse.lanes?.includes("topical")));
  assert.ok((verses[0]?.sourceScore ?? 0) > 0);
});

test("getPassageCandidates for lust expands seeds including Job 31:1", () => {
  const topical = getPassageCandidates("lust");
  const ids = topical.map((verse) => verse.id);
  assert.ok(topical.length > 3, `expected more than 3 topical hits, got ${topical.length}`);
  assert.ok(ids.includes("Matt.5.28"));
  assert.ok(ids.includes("1Cor.6.18"));
  assert.ok(ids.includes("Job.31.1"), "curated Job 31:1 must come from the topical lane");
  assert.ok(topical.every((verse) => verse.lanes?.includes("topical")));
});

test("topical lust is not the same set as lexical MiniSearch", () => {
  const topical = new Set(getPassageCandidates("lust").map((verse) => verse.id));
  const lexical = new Set(retrieve("lust", 80).map((verse) => verse.id));
  assert.ok(topical.has("Job.31.1"));
  assert.equal(lexical.has("Job.31.1"), false);
  assert.ok(topicMatchScore("bible verses about lust", { slug: "lust", label: "Lust", keywords: ["lust"], seeds: [] }) >= 0.9);
});
