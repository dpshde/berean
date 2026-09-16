import { TypeSafeClient } from "@typesafe-ai/sdk";
import { composeVerdict, type RelationAnswer } from "./compose.ts";
import { candidatesForPassage, parsePassageQuery } from "./lookup.ts";
import {
  asQuestionKind,
  buildQuestions,
  buildRerankQuestions,
  buildState,
  questionKindQuestion,
  rerankScores,
} from "./questions.ts";
import { applyRerankScores, FREE_FORM_EVIDENCE, mergeRecall, POLAR_EVIDENCE, RERANK_CAP } from "./recall.ts";
import { retrieve } from "./search.ts";
import { getPassageCandidates } from "./topics.ts";
import type { ClaimVerdict, QuestionKind, RecallCounts } from "./types.ts";
import { expandXrefs } from "./xrefs.ts";
import { versesToCandidates, zoomToVerses } from "./zoom.ts";

const MODEL = "jev-latest";

function client(): TypeSafeClient {
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) {
    throw new Error("Set TYPESAFE_API_KEY to judge a claim.");
  }
  return new TypeSafeClient({ apiKey, timeout: 180_000, defaultModel: MODEL });
}

function silentRelations(count: number): RelationAnswer[] {
  return Array.from({ length: count }, () => ({
    choice: "silent",
    probabilities: { silent: 1, supports: 0, contradicts: 0 },
    confidence: 0,
  }));
}

export async function judgeClaim(claim: string): Promise<ClaimVerdict> {
  const trimmed = claim.trim();
  if (!trimmed) {
    throw new Error("Write a claim.");
  }

  const passage = parsePassageQuery(trimmed);
  if (passage) {
    const lookedUp = candidatesForPassage(passage);
    if (lookedUp.length > 0) {
      return composeVerdict(
        trimmed,
        expandXrefs(lookedUp, 1),
        { questionKind: "free_form", supported: 0, denied: 0, relations: silentRelations(lookedUp.length) },
        [],
        lookedUp.length + 8,
      );
    }
  }

  const typesafe = client();
  const [zoomed, lexical, topical] = await Promise.all([
    zoomToVerses(trimmed, typesafe),
    Promise.resolve().then(() => retrieve(trimmed)),
    Promise.resolve().then(() => getPassageCandidates(trimmed)),
  ]);
  const beamCandidates = versesToCandidates(
    zoomed.verses,
    zoomed.beam.map((chip) => chip.score),
  );
  const recall: RecallCounts = {
    beam: beamCandidates.length,
    lexical: lexical.length,
    topical: topical.length,
  };
  const shortlist = mergeRecall({ beam: beamCandidates, lexical, topical }, RERANK_CAP);

  if (shortlist.length === 0) {
    const kindResponse = await typesafe.systemOne({
      state: { claim: trimmed },
      questions: { question_kind: questionKindQuestion() },
      model: MODEL,
    });
    const kindAnswer = kindResponse.answers.question_kind;
    const questionKind: QuestionKind = asQuestionKind(
      kindAnswer && kindAnswer.type === "choice"
        ? { choice: kindAnswer.choice, confidence: kindAnswer.confidence }
        : undefined,
    );
    return composeVerdict(
      trimmed,
      [],
      { questionKind, supported: 0, denied: 0, relations: [] },
      zoomed.beam,
      undefined,
      recall,
    );
  }

  const polarSlice = beamCandidates.length > 0 ? beamCandidates : shortlist.slice(0, 3);
  const response = await typesafe.systemOne({
    state: buildState(trimmed, shortlist),
    questions: {
      ...buildQuestions(polarSlice),
      ...buildRerankQuestions(shortlist),
    },
    model: MODEL,
  });

  const answers = response.answers;
  const kindAnswer = answers.question_kind;
  const questionKind: QuestionKind = asQuestionKind(
    kindAnswer && kindAnswer.type === "choice"
      ? { choice: kindAnswer.choice, confidence: kindAnswer.confidence }
      : undefined,
  );
  const supported = answers.supported && "noul" in answers.supported ? answers.supported.noul : 0;
  const denied = answers.denied && "noul" in answers.denied ? answers.denied.noul : 0;
  const relations: RelationAnswer[] = polarSlice.map((_, index) => {
    const answer = answers[`rel_${index}`];
    if (!answer || answer.type !== "choice") {
      return { choice: "silent", probabilities: { silent: 1, supports: 0, contradicts: 0 }, confidence: 0 };
    }
    return {
      choice: answer.choice,
      probabilities: answer.probabilities,
      confidence: answer.confidence,
    };
  });

  if (questionKind === "yes_no") {
    return composeVerdict(
      trimmed,
      polarSlice,
      { questionKind, supported, denied, relations },
      zoomed.beam,
      POLAR_EVIDENCE,
      recall,
    );
  }

  const ranked = applyRerankScores(shortlist, rerankScores(answers, shortlist.length)).slice(
    0,
    FREE_FORM_EVIDENCE,
  );
  const expanded = expandXrefs(ranked);
  return composeVerdict(
    trimmed,
    expanded,
    {
      questionKind: "free_form",
      supported,
      denied,
      relations: silentRelations(expanded.length),
    },
    zoomed.beam,
    expanded.length,
    recall,
  );
}
