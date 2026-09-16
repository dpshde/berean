# Berean

Yes/no claim check against the Berean Standard Bible. Code retrieves verses. TypeSafe judges them. The UI prints the verdict, then the evidence.

## TypeSafe

Read `.agents/skills/typesafe-ai/SKILL.md` and the live docs at https://docs.typesafe.ai/llms.txt before changing the judgment path.

- Keep control flow, retrieval, thresholds, and ranking in code.
- Do not replace System One questions with an LLM that generates a verdict in prose.
- Ask independent questions in one `systemOne` call. Do not add a serial round-trip unless an answer is required to fetch new state.
- Keep `TYPESAFE_API_KEY` server-side.

The live workflow is: Jev Choice zoom Book→Chapter→Verse (parallel beam K=3, `path_score = product(edge_p) ** (1 / decisions)`) → one TypeSafe request (`supported`, `denied`, per-verse `supports|contradicts|silent`) on the retained leaf verses → `composeVerdict()`.
