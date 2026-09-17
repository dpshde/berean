# Berean

Search the Berean Standard Bible. Code retrieves verses. TypeSafe judges them. Polar questions get a yes or no, then the evidence. Other queries get the verses.

## TypeSafe

Read `.agents/skills/typesafe-ai/SKILL.md` and the live docs at https://docs.typesafe.ai/llms.txt before changing the judgment path.

- Keep control flow, retrieval, thresholds, and ranking in code.
- Do not replace System One questions with an LLM that generates a verdict in prose.
- Ask independent questions in one `systemOne` call. Do not add a serial round-trip unless an answer is required to fetch new state.
- Keep `TYPESAFE_API_KEY` server-side.

The live workflow is: exact BCV lookups in code → otherwise **in parallel** (`Promise.all`) (1) Jev Choice zoom Book→Chapter, then at each retained chapter a semantic-find leaf (tagged chapter in state, Choice over verse IDs + exists Noul, `edge_p *= exists`) beam K=3, (2) MiniSearch lexical recall over BSB text (~80), (3) route.bible-style topical recall (`searchTopics` / `getPassageCandidates` over `data/topics.json` OSIS seeds, ranges expanded) → merge+dedupe by verse id (best `sourceScore`, union lane tags) capped ~80 → **then** one TypeSafe request (`question_kind`, speculative polar judgments on beam leaves, and a Noul rerank per shortlist verse) → free-form keeps the top 20 and appends licensed xrefs for the top seeds → `composeVerdict()` stitches incomplete leaves and emits yes/no only for polar questions. Each evidence card links to route.bible (`jhn.3.16`). Topical must run before Jev rerank and is not a substitute for the lexical lane.
