import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { corpusCandidates, resolveCorpusPath } from "../src/lib/bsb.ts";

test("resolves the packed BSB from the repo root", () => {
  const path = resolveCorpusPath();
  assert.ok(existsSync(path), `missing corpus at ${path}`);
  assert.match(path, /data[/\\]bsb\.json$/);
});

test("finds cwd/data/bsb.json when the module lives under dist/", () => {
  const root = mkdtempSync(join(tmpdir(), "berean-corpus-"));
  try {
    mkdirSync(join(root, "data"), { recursive: true });
    const moduleDir = join(root, "dist", "server", "chunks");
    mkdirSync(moduleDir, { recursive: true });
    const corpus = join(root, "data", "bsb.json");
    writeFileSync(corpus, "[]");

    const naiveFromModule = join(moduleDir, "../../data/bsb.json");
    assert.equal(existsSync(naiveFromModule), false, "naive import.meta.url hop should miss");

    const resolved = resolveCorpusPath({ cwd: root, moduleDir, envPath: "" });
    assert.equal(resolved, corpus);

    const candidates = corpusCandidates({ cwd: root, moduleDir, envPath: "" });
    assert.ok(candidates.includes(corpus));
    assert.ok(candidates.includes(join(root, "dist", "data", "bsb.json")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("prefers BSB_PATH when that file exists", () => {
  const root = mkdtempSync(join(tmpdir(), "berean-corpus-env-"));
  try {
    const override = join(root, "override.json");
    writeFileSync(override, "[]");
    const resolved = resolveCorpusPath({
      cwd: join(root, "missing"),
      moduleDir: join(root, "dist", "server"),
      envPath: override,
    });
    assert.equal(resolved, override);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("throws when no candidate exists", () => {
  const root = mkdtempSync(join(tmpdir(), "berean-corpus-miss-"));
  try {
    assert.throws(
      () =>
        resolveCorpusPath({
          cwd: root,
          moduleDir: join(root, "dist", "server", "chunks"),
          envPath: "",
        }),
      /BSB corpus not found/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
