import assert from "node:assert/strict";
import { test } from "node:test";
import type { TypeSafeClient } from "@typesafe-ai/sdk";
import type { Verse } from "../src/lib/types.ts";
import { createChooseFrontier } from "../src/lib/zoom.ts";

const john16: Verse = {
  id: "John.3.16",
  book: "John",
  chapter: 3,
  verse: 16,
  text: "For God so loved the world that He gave His one and only Son.",
};
const john17: Verse = {
  id: "John.3.17",
  book: "John",
  chapter: 3,
  verse: 17,
  text: "For God did not send His Son into the world to condemn the world.",
};

function mockClient(
  answers: Record<string, unknown>,
  captured: { state: unknown; questions: Record<string, { type?: string }> }[],
): TypeSafeClient {
  return {
    systemOne: async (request: { state: unknown; questions: Record<string, { type?: string }> }) => {
      captured.push({ state: request.state, questions: request.questions });
      return { answers };
    },
  } as TypeSafeClient;
}

test("book frontier stays a taxonomy Choice over claim-only state", async () => {
  const captured: { state: unknown; questions: Record<string, { type?: string }> }[] = [];
  const choose = createChooseFrontier(
    mockClient(
      {
        child_0: {
          type: "choice",
          probabilities: { c0: 0.7, c1: 0.3 },
        },
      },
      captured,
    ),
    "Is Jesus the Word of God?",
    (_path, label) => label,
  );

  const distributions = await choose([
    { path: [], labels: ["John", "Genesis"] },
  ]);

  assert.deepEqual(distributions, [{ John: 0.7, Genesis: 0.3 }]);
  assert.equal(captured[0]?.questions.child_0?.type, "choice");
  assert.equal(captured[0]?.questions.where_0, undefined);
  assert.deepEqual(captured[0]?.state, { claim: "Is Jesus the Word of God?" });
});

test("chapter leaf tags verses, asks where plus exists, and gates the beam edges", async () => {
  const captured: { state: unknown; questions: Record<string, { type?: string }> }[] = [];
  const choose = createChooseFrontier(
    mockClient(
      {
        where_0: { type: "choice", probabilities: { v016: 0.9, v017: 0.1 } },
        exists_0: { type: "noul", noul: 0.5 },
      },
      captured,
    ),
    "Did God give His Son?",
    () => "unused",
    (path) => (path[0] === "John" && path[1] === "3" ? [john16, john17] : []),
  );

  const distributions = await choose([
    { path: ["John", "3"], labels: ["16", "17"] },
  ]);

  assert.deepEqual(distributions, [{ "16": 0.45, "17": 0.05 }]);
  assert.equal(captured[0]?.questions.where_0?.type, "choice");
  assert.equal(captured[0]?.questions.exists_0?.type, "noul");
  assert.equal(captured[0]?.questions.child_0, undefined);

  const state = captured[0]?.state as {
    claim: string;
    passages: { p0: { ref: string; lines: string } };
  };
  assert.equal(state.claim, "Did God give His Son?");
  assert.equal(state.passages.p0.ref, "John 3");
  assert.match(state.passages.p0.lines, /^v016\| For God so loved/);
  assert.match(state.passages.p0.lines, /v017\| For God did not send/);
});

test("a silent chapter exists score collapses a forced verse winner", async () => {
  const choose = createChooseFrontier(
    mockClient(
      {
        where_0: { type: "choice", probabilities: { v016: 0.97, v017: 0.03 } },
        exists_0: { type: "noul", noul: 0.1 },
      },
      [],
    ),
    "Must Christians tithe exactly ten percent?",
    () => "unused",
    () => [john16, john17],
  );

  const [distribution] = await choose([{ path: ["John", "3"], labels: ["16", "17"] }]);
  assert.ok(distribution);
  assert.ok(distribution["16"] !== undefined && distribution["16"] < 0.1);
  assert.ok((distribution["16"] ?? 0) > (distribution["17"] ?? 0));
});
