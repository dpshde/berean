import { displayRangeRef } from "./bsb.ts";
import type { VerseJudgment } from "./types.ts";

export type Stitchable = Pick<
  VerseJudgment,
  "id" | "book" | "chapter" | "verse" | "text" | "relation" | "probabilities" | "confidence"
>;

function byCanon(left: Stitchable, right: Stitchable): number {
  if (left.book !== right.book) return left.book.localeCompare(right.book);
  if (left.chapter !== right.chapter) return left.chapter - right.chapter;
  return left.verse - right.verse;
}

export function canStitch(left: Stitchable, right: Stitchable): boolean {
  return (
    left.book === right.book &&
    left.chapter === right.chapter &&
    right.verse === left.verse + 1 &&
    left.relation === right.relation
  );
}

function rangeId(first: Stitchable, last: Stitchable): string {
  if (first.id === last.id) return first.id;
  return `${first.id}-${last.verse}`;
}

function pickLead<T extends Stitchable>(group: T[], scoreOf: (item: T) => number): T {
  return group.reduce((best, item) => (scoreOf(item) > scoreOf(best) ? item : best));
}

/**
 * Merge consecutive same-chapter, same-relation verses into one passage.
 * Ranking stays with the strongest member of each run.
 */
export function stitchJudgments<T extends Stitchable>(
  judgments: T[],
  scoreOf: (item: T) => number = () => 0,
): Array<T & Pick<VerseJudgment, "displayRef" | "text">> {
  if (judgments.length <= 1) {
    return judgments.map((judgment) => ({
      ...judgment,
      displayRef: displayRangeRef(judgment),
      text: judgment.text,
    }));
  }

  const sorted = [...judgments].sort(byCanon);
  const groups: T[][] = [];
  for (const judgment of sorted) {
    const current = groups.at(-1);
    const previous = current?.at(-1);
    if (previous && current && canStitch(previous, judgment)) {
      current.push(judgment);
    } else {
      groups.push([judgment]);
    }
  }

  return groups.map((group) => {
    const first = group[0];
    const last = group.at(-1);
    if (!first || !last) {
      throw new Error("stitchJudgments produced an empty group");
    }
    const lead = pickLead(group, scoreOf);
    return {
      ...lead,
      id: rangeId(first, last),
      book: first.book,
      chapter: first.chapter,
      verse: first.verse,
      displayRef: displayRangeRef(first, last),
      text: group.map((item) => item.text).join(" "),
    };
  });
}
