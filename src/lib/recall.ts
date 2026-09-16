import type { Candidate, RecallLane } from "./types.ts";

export const LEXICAL_LIMIT = 80;
export const RERANK_CAP = 80;
export const FREE_FORM_EVIDENCE = 20;
export const POLAR_EVIDENCE = 7;
export const XREF_SEEDS = 5;
export const XREF_PER_SEED = 4;

export type RecallLanes = {
  beam?: Candidate[];
  lexical?: Candidate[];
  topical?: Candidate[];
};

function laneWeight(lane: RecallLane): number {
  if (lane === "topical") return 1;
  if (lane === "beam") return 1;
  return 0.85;
}

function normalizeLane(candidates: Candidate[], lane: RecallLane): Candidate[] {
  const max = Math.max(...candidates.map((candidate) => candidate.sourceScore ?? candidate.searchScore), 1e-9);
  return candidates.map((candidate) => {
    const raw = candidate.sourceScore ?? candidate.searchScore;
    const sourceScore = (raw / max) * laneWeight(lane);
    const lanes = new Set<RecallLane>([...(candidate.lanes ?? []), lane]);
    return { ...candidate, sourceScore, lanes: [...lanes] };
  });
}

function mergeOne(into: Map<string, Candidate>, candidate: Candidate): void {
  const prior = into.get(candidate.id);
  if (!prior) {
    into.set(candidate.id, candidate);
    return;
  }
  const lanes = [...new Set([...(prior.lanes ?? []), ...(candidate.lanes ?? [])])];
  const sourceScore = Math.max(prior.sourceScore ?? 0, candidate.sourceScore ?? 0);
  const searchScore = Math.max(prior.searchScore, candidate.searchScore);
  into.set(candidate.id, { ...prior, ...candidate, lanes, sourceScore, searchScore });
}

/** Dedupe three recall lanes by verse id. Keep the best sourceScore and union lane tags. */
export function mergeRecall(lanes: RecallLanes, cap = RERANK_CAP): Candidate[] {
  const merged = new Map<string, Candidate>();
  for (const candidate of normalizeLane(lanes.beam ?? [], "beam")) mergeOne(merged, candidate);
  for (const candidate of normalizeLane(lanes.lexical ?? [], "lexical")) mergeOne(merged, candidate);
  for (const candidate of normalizeLane(lanes.topical ?? [], "topical")) mergeOne(merged, candidate);
  return [...merged.values()]
    .sort((left, right) => (right.sourceScore ?? 0) - (left.sourceScore ?? 0))
    .slice(0, cap);
}

export function applyRerankScores(candidates: Candidate[], scores: number[]): Candidate[] {
  return candidates
    .map((candidate, index) => ({
      ...candidate,
      searchScore: scores[index] ?? candidate.searchScore,
    }))
    .sort((left, right) => right.searchScore - left.searchScore);
}
