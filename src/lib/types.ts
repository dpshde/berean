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

export type VerseJudgment = {
  id: string;
  book: string;
  chapter: number;
  verse: number;
  displayRef: string;
  text: string;
  relation: Relation;
  probabilities: Record<Relation, number>;
  confidence: number;
};

export type Verdict = "yes" | "no";

export type BeamChip = {
  path: string;
  score: number;
  kind: "winner" | "beam";
};

export type ClaimVerdict = {
  claim: string;
  verdict: Verdict;
  supported: number;
  denied: number;
  evidence: VerseJudgment[];
  beam: BeamChip[];
  translation: "Berean Standard Bible";
};
