import { displayRangeRef, verseAfter } from "./bsb.ts";
import type { Verse, VerseJudgment } from "./types.ts";

export type Stitchable = Pick<
  VerseJudgment,
  "id" | "book" | "chapter" | "verse" | "text" | "relation" | "probabilities" | "confidence"
> & {
  endVerse?: number;
};

/** Mid-list / mid-sentence leaves (e.g. Galatians 5:22) need the next verse. */
export function isIncompleteVerseText(text: string): boolean {
  const trimmed = text.trimEnd();
  if (!trimmed) return false;
  return !/(?:[.!?…]["”'’)\]]*|["”])$/u.test(trimmed);
}

function spanEnd(item: Stitchable): number {
  return item.endVerse ?? item.verse;
}

function byCanon(left: Stitchable, right: Stitchable): number {
  if (left.book !== right.book) return left.book.localeCompare(right.book);
  if (left.chapter !== right.chapter) return left.chapter - right.chapter;
  return left.verse - right.verse;
}

export type StitchOptions = {
  requireSameRelation?: boolean;
};

export function canStitch(
  left: Stitchable,
  right: Stitchable,
  options: StitchOptions = {},
): boolean {
  const requireSameRelation = options.requireSameRelation ?? true;
  return (
    left.book === right.book &&
    left.chapter === right.chapter &&
    right.verse === left.verse + 1 &&
    (!requireSameRelation || left.relation === right.relation)
  );
}

function rangeId(first: Pick<Stitchable, "id">, last: Pick<Stitchable, "id" | "verse">): string {
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
  options: StitchOptions = {},
): Array<T & Pick<VerseJudgment, "displayRef" | "text">> {
  if (judgments.length <= 1) {
    return judgments.map((judgment) => ({
      ...judgment,
      endVerse: spanEnd(judgment),
      displayRef: displayRangeRef(judgment),
      text: judgment.text,
    }));
  }

  const sorted = [...judgments].sort(byCanon);
  const groups: T[][] = [];
  for (const judgment of sorted) {
    const current = groups.at(-1);
    const previous = current?.at(-1);
    if (previous && current && canStitch(previous, judgment, options)) {
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
      endVerse: last.verse,
      displayRef: displayRangeRef(first, last),
      text: group.map((item) => item.text).join(" "),
    };
  });
}

/**
 * If a passage still ends mid-sentence, pull the next same-chapter verse
 * from the corpus even when that verse was not a beam leaf.
 */
export function completeIncompletePassages<T extends Stitchable>(
  passages: T[],
  getNext: (book: string, chapter: number, verse: number) => Verse | undefined = verseAfter,
): Array<T & Pick<VerseJudgment, "displayRef" | "text" | "endVerse">> {
  return passages.map((passage) => {
    const endVerse = spanEnd(passage);
    const completed = {
      ...passage,
      endVerse,
      displayRef: displayRangeRef(passage, { ...passage, verse: endVerse }),
      text: passage.text,
    };
    if (!isIncompleteVerseText(completed.text)) return completed;
    const next = getNext(passage.book, passage.chapter, endVerse);
    if (!next) return completed;
    return {
      ...completed,
      id: rangeId(passage, next),
      endVerse: next.verse,
      displayRef: displayRangeRef(passage, next),
      text: `${completed.text} ${next.text}`,
    };
  });
}

/** Drop a card that is fully inside a longer stitched passage (e.g. 5:23 after 5:22–23). */
export function dropCoveredPassages<T extends Stitchable>(passages: T[]): T[] {
  return passages.filter((item, index) => {
    const itemEnd = spanEnd(item);
    return !passages.some((other, otherIndex) => {
      if (otherIndex === index) return false;
      if (other.book !== item.book || other.chapter !== item.chapter) return false;
      const otherEnd = spanEnd(other);
      const otherSpan = otherEnd - other.verse;
      const itemSpan = itemEnd - item.verse;
      const covers =
        other.verse <= item.verse && otherEnd >= itemEnd && otherSpan >= itemSpan;
      if (!covers) return false;
      if (otherSpan > itemSpan) return true;
      return otherIndex < index;
    });
  });
}
