import { FREE_FORM_EVIDENCE, POLAR_EVIDENCE } from "./recall.ts";
import { routeHref } from "./route.ts";
import { completeIncompletePassages, dropCoveredPassages, stitchJudgments } from "./stitch.ts";
import type {
  BeamChip,
  Candidate,
  ClaimVerdict,
  QuestionKind,
  Relation,
  Verdict,
  VerseJudgment,
} from "./types.ts";

export const SUPPORT_THRESHOLD = 0.5;

export type RelationAnswer = {
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
};

export type RawJudgment = {
  questionKind: QuestionKind;
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

export function composeVerdict(
  claim: string,
  candidates: Candidate[],
  raw: RawJudgment,
  beam: BeamChip[] = [],
  evidenceLimit?: number,
): ClaimVerdict {
  const supported = raw.supported;
  const denied = raw.denied;
  const polar = raw.questionKind === "yes_no";
  const verdict: Verdict | null = polar
    ? supported >= SUPPORT_THRESHOLD && supported >= denied
      ? "yes"
      : "no"
    : null;

  const judgments: VerseJudgment[] = candidates.map((candidate, index) => {
    const answer = raw.relations[index];
    const probabilities = {
      supports: answer?.probabilities.supports ?? 0,
      contradicts: answer?.probabilities.contradicts ?? 0,
      silent: answer?.probabilities.silent ?? 0,
    };
    return {
      id: candidate.id,
      book: candidate.book,
      chapter: candidate.chapter,
      verse: candidate.verse,
      endVerse: candidate.verse,
      displayRef: candidate.displayRef,
      href: routeHref(candidate.book, candidate.chapter, candidate.verse),
      text: candidate.text,
      relation: asRelation(answer?.choice ?? "silent"),
      probabilities,
      confidence: answer?.confidence ?? 0,
      searchScore: candidate.searchScore,
    };
  });

  const scoreOf = (judgment: VerseJudgment) =>
    verdict ? evidenceScore(judgment, verdict) : judgment.searchScore;

  const filtered = verdict
    ? judgments.filter(
        (judgment) => judgment.relation !== "silent" || evidenceScore(judgment, verdict) > 0.15,
      )
    : judgments;

  const limit = evidenceLimit ?? (verdict ? POLAR_EVIDENCE : FREE_FORM_EVIDENCE);
  const evidence = dropCoveredPassages(
    completeIncompletePassages(stitchJudgments(filtered, scoreOf, { requireSameRelation: Boolean(verdict) })),
  )
    .sort((a, b) => scoreOf(b) - scoreOf(a))
    .slice(0, limit)
    .map((item) => ({
      ...item,
      href: routeHref(item.book, item.chapter, item.verse, item.endVerse),
    }));

  return {
    claim,
    questionKind: polar ? "yes_no" : "free_form",
    verdict,
    supported,
    denied,
    evidence,
    beam,
    translation: "Berean Standard Bible",
  };
}
