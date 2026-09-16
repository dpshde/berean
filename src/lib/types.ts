export type Verse = {
  id: string;
  book: string;
  chapter: number;
  verse: number;
  text: string;
};

export type Candidate = Verse & {
  displayRef: string;
  context: string;
  searchScore: number;
};

export type Relation = "supports" | "contradicts" | "silent";

export type QuestionKind = "yes_no" | "free_form";

export type VerseJudgment = {
  id: string;
  book: string;
  chapter: number;
  verse: number;
  endVerse: number;
  displayRef: string;
  href: string;
  text: string;
  relation: Relation;
  probabilities: Record<Relation, number>;
  confidence: number;
  searchScore: number;
};

export type Verdict = "yes" | "no";

export type BeamChip = {
  path: string;
  score: number;
  kind: "winner" | "beam";
};

export type ClaimVerdict = {
  claim: string;
  questionKind: QuestionKind;
  verdict: Verdict | null;
  supported: number;
  denied: number;
  evidence: VerseJudgment[];
  beam: BeamChip[];
  translation: "Berean Standard Bible";
};
