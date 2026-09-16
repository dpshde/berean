import { choice, noul, type Questions } from "@typesafe-ai/sdk";
import type { Candidate, QuestionKind } from "./types.ts";

export const QUESTION_KIND_CONFIDENCE = 0.5;

export function questionKindQuestion() {
  return choice(
    {
      question: "Is `claim` a yes-or-no question?",
      inspect: ["claim"],
      focus:
        "Judge only the form of the request. Do not decide whether scripture answers it, and do not judge truth.",
    },
    {
      yes_no: {
        what: "A polar question: the natural answer is yes or no.",
        not_for:
          "Topics, phrases, passage references, open questions (what/why/how/who), or statements that are not asking for yes or no.",
        examples: ["Is Jesus God?", "Did Jesus rise from the dead?", "Should Christians tithe?"],
      },
      free_form: {
        what: "Anything that is not a yes-or-no question: a topic, phrase, passage, open question, or a statement.",
        not_for: "Questions whose natural answer is yes or no.",
        examples: ["John 3:16", "hope", "What is love?", "love your enemies", "Jesus is the Word of God"],
      },
    },
  );
}

export function asQuestionKind(answer: { choice?: string; confidence?: number } | undefined): QuestionKind {
  if (answer?.choice === "yes_no" && (answer.confidence ?? 0) >= QUESTION_KIND_CONFIDENCE) {
    return "yes_no";
  }
  return "free_form";
}

export function buildState(claim: string, candidates: Candidate[]) {
  return {
    claim,
    translation: "Berean Standard Bible",
    verses: candidates.map((verse, index) => ({
      index,
      ref: verse.displayRef,
      text: verse.text,
      neighboring_verses: verse.context,
    })),
  };
}

export function buildQuestions(candidates: Candidate[]): Questions {
  const supportOptions: Record<string, string | null> = {
    none: "None of the supplied verses support the claim",
  };
  const denyOptions: Record<string, string | null> = {
    none: "None of the supplied verses contradict the claim",
  };

  const questions: Questions = {
    question_kind: questionKindQuestion(),
    supported: noul(
      {
        question: "Does the supplied Berean Standard Bible scripture support `claim` as true?",
        inspect: ["claim", "verses"],
        focus:
          "Judge only from the supplied verses. Direct statements outrank topical resemblance. Do not use unstated tradition.",
      },
      {
        true: "One or more supplied verses state or directly imply that the claim is true",
        false: "The supplied verses do not establish the claim",
      },
    ),
    denied: noul(
      {
        question: "Does the supplied Berean Standard Bible scripture deny `claim`, showing it is false?",
        inspect: ["claim", "verses"],
        focus:
          "Judge only from the supplied verses. A verse that is merely silent is not a denial.",
      },
      {
        true: "One or more supplied verses state or directly imply that the claim is false",
        false: "The supplied verses do not contradict the claim",
      },
    ),
  };

  for (const [index, verse] of candidates.entries()) {
    const key = `v${index}`;
    supportOptions[key] = verse.displayRef;
    denyOptions[key] = verse.displayRef;
    questions[`rel_${index}`] = choice(
      {
        question: `How does \`verses[${index}]\` relate to \`claim\`?`,
        inspect: [`verses[${index}].text`, `verses[${index}].neighboring_verses`, "claim"],
        focus: "Use the verse itself. Neighboring verses are context only.",
      },
      {
        supports: "The verse states the claim or directly implies that it is true",
        contradicts: "The verse states the opposite of the claim or implies it is false",
        silent: "The verse does not address what the claim asserts, either way",
      },
    );
  }

  questions.best_support = choice(
    "Which supplied verse most strongly supports `claim` as true?",
    supportOptions,
  );
  questions.best_deny = choice(
    "Which supplied verse most strongly contradicts `claim`?",
    denyOptions,
  );

  return questions;
}
