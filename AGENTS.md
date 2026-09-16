# Berean

Search the Berean Standard Bible. Code retrieves verses. TypeSafe judges them. Polar questions get a yes or no, then the evidence. Other queries get the verses.

## TypeSafe

Read `.agents/skills/typesafe-ai/SKILL.md` and the live docs at https://docs.typesafe.ai/llms.txt before changing the judgment path.

- Keep control flow, retrieval, thresholds, and ranking in code.
- Do not replace System One questions with an LLM that generates a verdict in prose.
- Ask independent questions in one `systemOne` call. Do not add a serial round-trip unless an answer is required to fetch new state.
- Keep `TYPESAFE_API_KEY` server-side.

The live workflow is: exact BCV lookups in code → otherwise Jev Choice zoom Book→Chapter→Verse (parallel beam K=3) plus MiniSearch lexical recall (~80) merged and capped at 40 → one TypeSafe request (`question_kind`, speculative polar judgments on beam leaves, and a Noul rerank per shortlist verse) → free-form keeps the top 20 and appends licensed xrefs for the top seeds → `composeVerdict()` stitches incomplete leaves and emits yes/no only for polar questions. Each evidence card links to route.bible (`jhn.3.16`).
