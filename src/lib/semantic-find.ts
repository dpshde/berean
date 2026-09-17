import { choice, noul, type Questions } from "@typesafe-ai/sdk";
import type { Verse } from "./types.ts";

export function verseLineId(verse: number | string): string {
  const n = typeof verse === "number" ? verse : Number(verse);
  if (!Number.isFinite(n) || n < 1) return "v000";
  return `v${String(n).padStart(3, "0")}`;
}

export function passageField(index: number): string {
  return `p${index}`;
}

export function tagChapter(verses: readonly Pick<Verse, "verse" | "text">[]): string {
  return verses.map((verse) => `${verseLineId(verse.verse)}| ${verse.text}`).join("\n");
}

export function applyExists(
  probabilities: Record<string, number>,
  exists: number | undefined,
): Record<string, number> {
  const gate = exists === undefined || !Number.isFinite(exists) ? 1 : Math.min(1, Math.max(0, exists));
  const scaled: Record<string, number> = {};
  for (const [label, probability] of Object.entries(probabilities)) {
    scaled[label] = probability * gate;
  }
  return scaled;
}

export function lineCriteria(labels: readonly string[]): Record<string, null> {
  const criteria: Record<string, null> = {};
  for (const label of labels) {
    criteria[verseLineId(label)] = null;
  }
  return criteria;
}

export function chapterFindQuestions(index: number, labels: readonly string[]): Questions {
  const field = `passages.${passageField(index)}`;
  return {
    [`where_${index}`]: choice(
      {
        question: `Which line of \`${field}.lines\` contains the answer to \`claim\`?`,
        inspect: ["claim", `${field}.lines`, `${field}.ref`],
        focus:
          "Stay inside this chapter. Pick a tagged verse ID. Neighboring chapters are out of scope. Direct statements outrank topical resemblance.",
      },
      lineCriteria(labels),
    ),
    [`exists_${index}`]: noul(
      {
        question: `Does any line of \`${field}.lines\` address or answer \`claim\`?`,
        inspect: ["claim", `${field}.lines`],
        focus: "Judge only this chapter. A heading or shared word is not an answer.",
      },
      {
        true: "At least one verse in this chapter states or directly implies the answer",
        false: "No verse in this chapter addresses this",
      },
    ),
  };
}

export function mapLineProbabilities(
  labels: readonly string[],
  probabilities: Record<string, number> | undefined,
): Record<string, number> {
  const mapped: Record<string, number> = {};
  for (const label of labels) {
    mapped[label] = probabilities?.[verseLineId(label)] ?? 0;
  }
  return mapped;
}

export function chapterFindDistribution(
  labels: readonly string[],
  where: { type?: string; probabilities?: Record<string, number> } | undefined,
  exists: { type?: string; noul?: number } | undefined,
): Record<string, number> {
  const probabilities = where && where.type === "choice" ? where.probabilities : undefined;
  const existsNoul = exists && "noul" in exists ? exists.noul : undefined;
  return applyExists(mapLineProbabilities(labels, probabilities), existsNoul);
}
