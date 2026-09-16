import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { candidatesForPassage, parsePassageQuery } from "./lookup.ts";
import type { Candidate } from "./types.ts";

const TOPIC_REL = join("data", "topics.json");
const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const MATCH_FLOOR = 0.7;
const SOURCE_SCORE_MAX = 7;

export type TopicSeed = {
  osis: string;
  sourceScore: number;
};

export type Topic = {
  slug: string;
  label: string;
  keywords: string[];
  seeds: TopicSeed[];
};

export type TopicHit = Topic & {
  matchScore: number;
};

type TopicFile = { topics: Topic[] };

let packed: Topic[] | null = null;

function resolveTopicPath(): string | undefined {
  const envPath = process.env.TOPIC_PATH;
  const candidates = [
    envPath,
    join(process.cwd(), TOPIC_REL),
    join(MODULE_DIR, "..", "..", TOPIC_REL),
    join(MODULE_DIR, "..", "..", "..", TOPIC_REL),
  ].filter((path): path is string => Boolean(path));
  for (const path of candidates) {
    const absolute = resolve(path);
    if (existsSync(absolute)) return absolute;
  }
  return undefined;
}

export function loadTopics(): Topic[] {
  if (packed) return packed;
  const path = resolveTopicPath();
  packed = path ? ((JSON.parse(readFileSync(path, "utf8")) as TopicFile).topics ?? []) : [];
  return packed;
}

function normalize(value: string): string {
  return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, " ").trim();
}

function tokensOf(value: string): string[] {
  return normalize(value).split(" ").filter((token) => token.length > 0);
}

/** Match a query to topic label, slug, or keywords. Not a BSB keyword search. */
export function topicMatchScore(query: string, topic: Topic): number {
  const q = normalize(query);
  if (!q) return 0;
  const qTokens = new Set(tokensOf(q));
  const slug = normalize(topic.slug);
  const label = normalize(topic.label);
  if (q === slug || q === label) return 1;
  if (qTokens.has(slug) || qTokens.has(label)) return 0.95;

  let best = 0;
  for (const keyword of [slug, label, ...topic.keywords]) {
    const key = normalize(keyword);
    if (!key) continue;
    if (q === key) return 1;
    if (qTokens.has(key)) best = Math.max(best, 0.92);
    if (key.includes(" ") && q.includes(key)) best = Math.max(best, 0.9);
    const keyTokens = tokensOf(key);
    if (keyTokens.length > 1 && keyTokens.every((token) => qTokens.has(token))) {
      best = Math.max(best, 0.88);
    }
  }
  return best;
}

export function searchTopics(query: string, limit = 4): TopicHit[] {
  return loadTopics()
    .map((topic) => ({ ...topic, matchScore: topicMatchScore(query, topic) }))
    .filter((topic) => topic.matchScore >= MATCH_FLOOR)
    .sort((left, right) => right.matchScore - left.matchScore)
    .slice(0, limit);
}

export function expandOsisSeed(osis: string, sourceScore: number, topicScore = 1): Candidate[] {
  const passage = parsePassageQuery(osis);
  if (!passage) return [];
  const normalized = Math.max(sourceScore, 1) / SOURCE_SCORE_MAX;
  const score = normalized * topicScore;
  return candidatesForPassage(passage).map((candidate) => ({
    ...candidate,
    searchScore: score,
    sourceScore: score,
    lanes: ["topical"],
  }));
}

/** Expand curated OSIS seeds for topics matching the query. Ranges become BSB verses. */
export function getPassageCandidates(query: string, limit = 80): Candidate[] {
  const merged = new Map<string, Candidate>();
  for (const topic of searchTopics(query)) {
    for (const seed of topic.seeds) {
      for (const candidate of expandOsisSeed(seed.osis, seed.sourceScore, topic.matchScore)) {
        const prior = merged.get(candidate.id);
        if (!prior || (candidate.sourceScore ?? 0) > (prior.sourceScore ?? 0)) {
          merged.set(candidate.id, candidate);
        }
      }
    }
  }
  return [...merged.values()]
    .sort((left, right) => (right.sourceScore ?? 0) - (left.sourceScore ?? 0))
    .slice(0, limit);
}

export function topicHref(slug: string): string {
  return `https://route.bible/topics/${slug}`;
}
