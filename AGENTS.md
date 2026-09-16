# Berean

Search the Berean Standard Bible. Code retrieves verses. TypeSafe judges them. Polar questions get a yes or no, then the evidence. Other queries get the verses.

## TypeSafe

Read `.agents/skills/typesafe-ai/SKILL.md` and the live docs at https://docs.typesafe.ai/llms.txt before changing the judgment path.

- Keep control flow, retrieval, thresholds, and ranking in code.
- Do not replace System One questions with an LLM that generates a verdict in prose.
- Ask independent questions in one `systemOne` call. Do not add a serial round-trip unless an answer is required to fetch new state.
- Keep `TYPESAFE_API_KEY` server-side.

The live workflow is: Jev Choice zoom Book→Chapter→Verse (parallel beam K=3, `path_score = product(edge_p) ** (1 / decisions)`) → one TypeSafe request (`question_kind` yes_no|free_form, plus speculative `supported`, `denied`, per-verse `supports|contradicts|silent`) on the retained leaf verses → `composeVerdict()`, which emits a yes/no only for polar questions, stitches consecutive same-chapter hits, and completes a leaf that does not end in sentence-final punctuation by pulling the next same-chapter verse.
