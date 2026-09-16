# Berean

Type a claim. Get **yes** or **no**. Then the Berean Standard Bible verses that best support that verdict.

Code finds candidate verses. [TypeSafe](https://docs.typesafe.ai) (Jev) judges whether those verses support or deny the claim. The page does not generate commentary.

> Now the Bereans were more noble-minded than the Thessalonians, for they received the message with great eagerness and examined the Scriptures every day to see if these teachings were true. — Acts 17:11, BSB

## Run

```bash
cp .env.example .env   # set TYPESAFE_API_KEY
npm install
npm test
npm run dev
```

Open http://localhost:4321

The key stays on the server. Get one at https://console.typesafe.ai

## How it decides

1. Search the packed BSB (`data/bsb.json`) for a shortlist of verses.
2. Ask TypeSafe, in one call:
   - does this scripture support the claim?
   - does it deny the claim?
   - for each verse: supports / contradicts / silent
3. **Yes** only if support ≥ 0.5 and support ≥ denial. Otherwise **no**.
4. Rank the shortlist by the matching probability and show those verses.

The BSB text is public domain. See `data/NOTICE`.
