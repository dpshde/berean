import { childrenOf, formatPath, type CanonTree } from "./canon.ts";
import type { BeamChip } from "./types.ts";

export const BEAM_WIDTH = 3;
export const MAX_DEPTH = 3;
export const EPSILON = 1e-9;

export type BeamCandidate = {
  path: string[];
  probabilityProduct: number;
  decisionCount: number;
  score: number;
};

export type FrontierRequest = {
  path: string[];
  labels: string[];
};

export type ChooseFrontier = (requests: FrontierRequest[]) => Promise<Record<string, number>[]>;

export type BeamSearchResult = {
  beam: BeamCandidate[];
  winner: BeamCandidate | undefined;
  retained: BeamChip[];
};

export function pathScore(probabilityProduct: number, decisionCount: number): number {
  if (decisionCount === 0) return 1;
  return probabilityProduct ** (1 / decisionCount);
}

export function rootCandidate(): BeamCandidate {
  return {
    path: [],
    probabilityProduct: 1,
    decisionCount: 0,
    score: 1,
  };
}

/**
 * Append one edge. Single-child edges are not decisions and do not
 * change the geometric-mean product (cookbook hierarchical classification).
 */
export function extendCandidate(
  candidate: BeamCandidate,
  label: string,
  probabilities: Record<string, number>,
  epsilon = EPSILON,
): BeamCandidate {
  const isDecision = Object.keys(probabilities).length > 1;
  const edge = probabilities[label] ?? 0;
  const probabilityProduct =
    candidate.probabilityProduct * (isDecision ? Math.max(edge, epsilon) : 1);
  const decisionCount = candidate.decisionCount + (isDecision ? 1 : 0);
  return {
    path: [...candidate.path, label],
    probabilityProduct,
    decisionCount,
    score: pathScore(probabilityProduct, decisionCount),
  };
}

export function pruneBeam(candidates: BeamCandidate[], width = BEAM_WIDTH): BeamCandidate[] {
  return [...candidates].sort((left, right) => right.score - left.score).slice(0, width);
}

export async function beamSearch(
  tree: CanonTree,
  chooseFrontier: ChooseFrontier,
  options: { beamWidth?: number; maxDepth?: number; epsilon?: number } = {},
): Promise<BeamSearchResult> {
  const beamWidth = options.beamWidth ?? BEAM_WIDTH;
  const maxDepth = options.maxDepth ?? MAX_DEPTH;
  const epsilon = options.epsilon ?? EPSILON;
  let beam: BeamCandidate[] = [rootCandidate()];

  for (let depth = 0; depth < maxDepth; depth += 1) {
    const expandable = beam.filter((candidate) => childrenOf(tree, candidate.path).length > 0);
    const finished = beam.filter((candidate) => childrenOf(tree, candidate.path).length === 0);
    if (expandable.length === 0) break;

    const requests = expandable.map((candidate) => ({
      path: candidate.path,
      labels: childrenOf(tree, candidate.path),
    }));
    const distributions = await chooseFrontier(requests);
    if (distributions.length !== expandable.length) {
      throw new Error("chooseFrontier must return one distribution per expandable path");
    }

    const expanded: BeamCandidate[] = [];
    for (const [index, candidate] of expandable.entries()) {
      const probabilities = distributions[index] ?? {};
      for (const label of Object.keys(probabilities)) {
        expanded.push(extendCandidate(candidate, label, probabilities, epsilon));
      }
    }

    beam = pruneBeam([...finished, ...expanded], beamWidth);
  }

  beam = pruneBeam(beam, beamWidth);
  const winner = beam[0];
  const retained: BeamChip[] = beam.map((candidate, index) => ({
    path: formatPath(candidate.path),
    score: candidate.score,
    kind: index === 0 ? "winner" : "beam",
  }));

  return { beam, winner, retained };
}
