import type { QuestionKind, Verdict } from "./types.ts";

export type StatusView = {
  showVerdict: boolean;
  verdictLabel: string;
  verdictMeta: string;
  showRelations: boolean;
};

export function statusView(input: {
  questionKind?: QuestionKind | string;
  verdict?: Verdict | string | null;
}): StatusView {
  const polar = input.questionKind === "yes_no" && (input.verdict === "yes" || input.verdict === "no");
  if (!polar) {
    return {
      showVerdict: false,
      verdictLabel: "",
      verdictMeta: "BSB",
      showRelations: false,
    };
  }
  return {
    showVerdict: true,
    verdictLabel: input.verdict === "yes" ? "Yes" : "No",
    verdictMeta: input.verdict === "yes" ? "supported · BSB" : "not supported · BSB",
    showRelations: true,
  };
}
