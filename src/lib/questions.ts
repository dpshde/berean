import { choice, noul, type Questions } from "@typesafe-ai/sdk";
import type { Candidate } from "./types.ts";

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
