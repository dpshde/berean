import type { Candidate } from "./types.ts";

export const LEXICAL_LIMIT = 80;
export const RERANK_CAP = 40;
export const FREE_FORM_EVIDENCE = 20;
export const POLAR_EVIDENCE = 7;
export const XREF_SEEDS = 5;
export const XREF_PER_SEED = 4;

/** Beam leaves first, then lexical hits, deduped by verse id, capped for Jev rerank. */
export function mergeRecall(beam: Candidate[], lexical: Candidate[], cap = RERANK_CAP): Candidate[] {
  const merged: Candidate[] = [];
  const seen = new Set<string>();
  for (const candidate of [...beam, ...lexical]) {
    if (seen.has(candidate.id)) continue;
    seen.add(candidate.id);
    merged.push(candidate);
    if (merged.length >= cap) break;
  }
  return merged;
}

export function applyRerankScores(candidates: Candidate[], scores: number[]): Candidate[] {
  return candidates
    .map((candidate, index) => ({
      ...candidate,
      searchScore: scores[index] ?? candidate.searchScore,
    }))
    .sort((left, right) => right.searchScore - left.searchScore);
}
