import type { Candidate, ClaimVerdict, Relation, Verdict, VerseJudgment } from "./types.ts";

export const SUPPORT_THRESHOLD = 0.5;

export type RelationAnswer = {
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
};

export type RawJudgment = {
  supported: number;
  denied: number;
  relations: RelationAnswer[];
};

function asRelation(choice: string): Relation {
  if (choice === "supports" || choice === "contradicts") return choice;
  return "silent";
}

function evidenceScore(judgment: VerseJudgment, verdict: Verdict): number {
  if (verdict === "yes") return judgment.probabilities.supports;
  return judgment.probabilities.contradicts;
}

export function composeVerdict(claim: string, candidates: Candidate[], raw: RawJudgment): ClaimVerdict {
  const supported = raw.supported;
  const denied = raw.denied;
  const verdict: Verdict =
    supported >= SUPPORT_THRESHOLD && supported >= denied ? "yes" : "no";

  const judgments: VerseJudgment[] = candidates.map((candidate, index) => {
    const answer = raw.relations[index];
    const probabilities = {
      supports: answer?.probabilities.supports ?? 0,
      contradicts: answer?.probabilities.contradicts ?? 0,
      silent: answer?.probabilities.silent ?? 0,
    };
    return {
      id: candidate.id,
      displayRef: candidate.displayRef,
      text: candidate.text,
      relation: asRelation(answer?.choice ?? "silent"),
      probabilities,
      confidence: answer?.confidence ?? 0,
    };
  });

  const evidence = judgments
    .filter((judgment) => judgment.relation !== "silent" || evidenceScore(judgment, verdict) > 0.15)
    .sort((a, b) => evidenceScore(b, verdict) - evidenceScore(a, verdict))
    .slice(0, 7);

  return {
    claim,
    verdict,
    supported,
    denied,
    evidence,
    translation: "Berean Standard Bible",
  };
}
