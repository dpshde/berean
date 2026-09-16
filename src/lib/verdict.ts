import { TypeSafeClient } from "@typesafe-ai/sdk";
import { composeVerdict, type RelationAnswer } from "./compose.ts";
import { buildQuestions, buildState } from "./questions.ts";
import { retrieve } from "./search.ts";
import type { ClaimVerdict } from "./types.ts";

const MODEL = "jev-latest";

function client(): TypeSafeClient {
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) {
    throw new Error("Set TYPESAFE_API_KEY to judge a claim.");
  }
  return new TypeSafeClient({ apiKey, timeout: 60_000, defaultModel: MODEL });
}

export async function judgeClaim(claim: string): Promise<ClaimVerdict> {
  const trimmed = claim.trim();
  if (!trimmed) {
    throw new Error("Write a claim.");
  }

  const candidates = retrieve(trimmed);
  if (candidates.length === 0) {
    return {
      claim: trimmed,
      verdict: "no",
      supported: 0,
      denied: 0,
      evidence: [],
      translation: "Berean Standard Bible",
    };
  }

  const typesafe = client();
  const response = await typesafe.systemOne({
    state: buildState(trimmed, candidates),
    questions: buildQuestions(candidates),
    model: MODEL,
  });

  const answers = response.answers;
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

  return composeVerdict(trimmed, candidates, { supported, denied, relations });
}
