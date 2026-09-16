import { TypeSafeClient } from "@typesafe-ai/sdk";
import { composeVerdict, type RelationAnswer } from "./compose.ts";
import { asQuestionKind, buildQuestions, buildState, questionKindQuestion } from "./questions.ts";
import type { ClaimVerdict, QuestionKind } from "./types.ts";
import { versesToCandidates, zoomToVerses } from "./zoom.ts";

const MODEL = "jev-latest";

function client(): TypeSafeClient {
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) {
    throw new Error("Set TYPESAFE_API_KEY to judge a claim.");
  }
  return new TypeSafeClient({ apiKey, timeout: 180_000, defaultModel: MODEL });
}

export async function judgeClaim(claim: string): Promise<ClaimVerdict> {
  const trimmed = claim.trim();
  if (!trimmed) {
    throw new Error("Write a claim.");
  }

  const typesafe = client();
  const zoomed = await zoomToVerses(trimmed, typesafe);
  const candidates = versesToCandidates(
    zoomed.verses,
    zoomed.beam.map((chip) => chip.score),
  );

  if (candidates.length === 0) {
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
    );
  }

  const response = await typesafe.systemOne({
    state: buildState(trimmed, candidates),
    questions: buildQuestions(candidates),
    model: MODEL,
  });

  const answers = response.answers;
  const kindAnswer = answers.question_kind;
  const questionKind: QuestionKind = asQuestionKind(
    kindAnswer && kindAnswer.type === "choice"
      ? { choice: kindAnswer.choice, confidence: kindAnswer.confidence }
      : undefined,
  );
  const supported = "noul" in answers.supported ? answers.supported.noul : 0;
  const denied = "noul" in answers.denied ? answers.denied.noul : 0;
  const relations: RelationAnswer[] = candidates.map((_, index) => {
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

  return composeVerdict(trimmed, candidates, { questionKind, supported, denied, relations }, zoomed.beam);
}
