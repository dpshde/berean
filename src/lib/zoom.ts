import { TypeSafeClient, choice, type Questions } from "@typesafe-ai/sdk";
import { displayRef, neighborContext } from "./bsb.ts";
import { beamSearch, type FrontierRequest } from "./beam.ts";
import { buildCanon, formatPath, verseAt } from "./canon.ts";
import type { BeamChip, Candidate, Verse } from "./types.ts";

const MODEL = "jev-latest";

function criteriaFor(labels: string[], describe: (label: string) => string): Record<string, string> {
  const criteria: Record<string, string> = {};
  for (const [index, label] of labels.entries()) {
    criteria[`c${index}`] = describe(label);
  }
  return criteria;
}

function questionFor(path: string[]): {
  question: string;
  inspect: string[];
  focus: string;
} {
  const node = formatPath(path);
  if (path.length === 0) {
    return {
      question: "Which book of the Berean Standard Bible best addresses `claim`?",
      inspect: ["claim"],
      focus:
        "Choose the book most likely to contain the verse that judges the claim. Direct statements outrank topical resemblance.",
    };
  }
  if (path.length === 1) {
    return {
      question: `Which chapter of ${node} best addresses \`claim\`?`,
      inspect: ["claim"],
      focus: `Stay inside ${node}. Pick the chapter most likely to judge the claim.`,
    };
  }
  return {
    question: `Which verse of ${node} best addresses \`claim\`?`,
    inspect: ["claim"],
    focus: `Stay inside ${node}. Use the verse wording in the options. Neighboring chapters are out of scope.`,
  };
}

function mapProbabilities(
  labels: string[],
  probabilities: Record<string, number> | undefined,
): Record<string, number> {
  const mapped: Record<string, number> = {};
  for (const [index, label] of labels.entries()) {
    mapped[label] = probabilities?.[`c${index}`] ?? 0;
  }
  return mapped;
}

export function createChooseFrontier(
  typesafe: TypeSafeClient,
  claim: string,
  describe: (path: string[], label: string) => string,
): (requests: FrontierRequest[]) => Promise<Record<string, number>[]> {
  return async (requests) => {
    const results: Record<string, number>[] = requests.map((request) => {
      if (request.labels.length === 1) {
        return { [request.labels[0] ?? ""]: 1 };
      }
      return {};
    });

    const questions: Questions = {};
    const pending: { index: number; labels: string[] }[] = [];

    for (const [index, request] of requests.entries()) {
      if (request.labels.length <= 1) continue;
      const asked = questionFor(request.path);
      questions[`child_${index}`] = choice(
        asked,
        criteriaFor(request.labels, (label) => describe(request.path, label)),
      );
      pending.push({ index, labels: request.labels });
    }

    if (pending.length === 0) return results;

    const response = await typesafe.systemOne({
      state: { claim },
      questions,
      model: MODEL,
    });

    for (const item of pending) {
      const answer = response.answers[`child_${item.index}`];
      const probabilities = answer && answer.type === "choice" ? answer.probabilities : undefined;
      results[item.index] = mapProbabilities(item.labels, probabilities);
    }

    return results;
  };
}

export async function zoomToVerses(
  claim: string,
  typesafe: TypeSafeClient,
): Promise<{ verses: Verse[]; beam: BeamChip[] }> {
  const canon = buildCanon();
  const describe = (path: string[], label: string): string => {
    const next = [...path, label];
    if (next.length < 3) return formatPath(next);
    const verse = verseAt(canon, next);
    return verse ? `${displayRef(verse)} — ${verse.text}` : formatPath(next);
  };

  const result = await beamSearch(canon.tree, createChooseFrontier(typesafe, claim, describe));
  const verses = result.beam
    .map((candidate) => verseAt(canon, candidate.path))
    .filter((verse): verse is Verse => Boolean(verse));

  return { verses, beam: result.retained };
}

export function versesToCandidates(verses: Verse[], scores: number[]): Candidate[] {
  return verses.map((verse, index) => ({
    ...verse,
    displayRef: displayRef(verse),
    context: neighborContext(verse.id),
    searchScore: scores[index] ?? 0,
    sourceScore: scores[index] ?? 0,
    lanes: ["beam"],
  }));
}
