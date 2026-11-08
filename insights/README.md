# Because (insights) · AI interviews on PostHog data

Phase 1 from `../plan-ai-intervjui.md` (Checkpoint 1): **PostHog events → profile with facts → group → AI interview → saved result.**

## Setup

```
npm install
cp .env.example .env.local   # fill in the keys
```

| Variable | Purpose |
| --- | --- |
| `PERPLEXITY_API_KEY` | Claude through the Perplexity Agent API (hackathon credits). Takes priority if set. |
| `ANTHROPIC_API_KEY` | Claude directly, when there is no Perplexity key (`INTERVIEW_MODEL`, default `claude-opus-5-5`) |
| `POSTHOG_KEY`, `POSTHOG_HOST` | Project token (`phc_...`): seed (and later write-back) |
| `POSTHOG_PERSONAL_KEY`, `POSTHOG_PROJECT_ID`, `POSTHOG_API_HOST` | Personal key with **Query Read**: reading events |
| `POSTHOG_IGNORE_BEFORE` | Optional. Events ingested before this time are ignored (default `2026-11-08T12:30:00Z`, the switch to English) |

## Flow

```
npm run seed                          # ~200 people, ~100k events over 30 days -> PostHog + data/seed-backup.json
npm run seed -- --dry-run             # local backup only, no PostHog
npm run fetch                         # HogQL -> data/cache.json, prints the number of people per group
npm run fetch -- --local              # same, over the existing cache or seed backup
npm run facts -- sample_doctor_017    # facts with IDs and the group for one person
npm run simulate -- --per 8           # simulated interviews, 8 per group (simulated: true), written to PostHog
npm run simulate -- --per 1 --segment new --no-posthog   # quick test
npm run synthesize                    # reason synthesis per group (Claude) -> data/synthesis/<group>.json
npm run name-segments                 # Claude names the groups and phrases their research questions -> data/segment-names.json (also a button on the home page)
npm run dev                           # http://localhost:3000
```

Live demo: `POSTHOG_KEY=phc_... java -jar ../folio/folio/folio.jar --profile doctor --user "Ana Zirij"` sends events as the person `folio_ana_zirij`. Then "Refresh from PostHog" on the home page, or go straight to `/interview/folio_ana_zirij` (if the person is not in the cache, the page pulls again by itself).

Without PostHog keys the app runs on `data/seed-backup.json`.

## Parts

| File | What it does |
| --- | --- |
| `lib/types.ts` | Contract between the parts (`Fact`, `Profile`, `Segment`, `InterviewResult`). Do not change without agreement. |
| `lib/posthog.ts` | 3 HogQL queries (use per tool, person, today's activity), one at a time, cached in `data/cache.json` |
| `lib/facts.ts` | Facts with IDs; computed by code, not the model |
| `lib/segments.ts` | Rules for 5 behavior groups |
| `lib/sample.ts` | Seeded people have IDs `sample_<role>_<nnn>`; everyone else is a live Folio user |
| `lib/interview.ts` | System prompt, chat call, structured result (JSON schema from zod) |
| `lib/llm.ts` | One model call: Perplexity `/v1/agent` (`anthropic/claude-opus-5-5`, `tool_choice: none` = no web search) or Anthropic directly |
| `lib/store.ts` | Results in `data/results/<userId>.json`, then written to PostHog |
| `lib/capture.ts` | Write-back: the `ai_interview_completed` event + `$set` (`ai_segment`, `ai_main_reason`, `ai_sentiment`, `ai_suggested_change`, `ai_interview_simulated`, `ai_interviewed_at`) |
| `lib/synthesis.ts` | Reason synthesis per group: one model call groups the interviews into themes; code checks the people counts and quotes |
| `scripts/simulate.ts` | A second Claude plays the user with a hidden reason; at the end it compares the reason found with the hidden one |
| `scripts/synthesize.ts` | Prints the synthesis for all groups (`--segment <id>`, `--force`) |
| `app/segment/[id]` | Group screen: users, interview status, reasons with quotes |
| `app/interview/[userId]` | Chat screen + facts on the side |
| `app/api/*` | `refresh`, `segments`, `segments/[id]/synthesis`, `profile/[userId]`, `interview`, `interview/finish` |

### Group rules

1. **Tried AI, then quit** (`tried_ai`): AI summary used 1–2 times, the last time more than 14 days ago (cuts across roles).
2. **New and inactive** (`new`): < 10 uses or a first visit in the last 7 days, *with no dominant pattern* (> 50%). A new person who already clearly signs (the live demo) goes to Signers.
3. Otherwise the group with the largest share: **Signers** (`signers`: sign + fill form), **Readers and searchers** (`readers`: search + export text), **Compliance** (`compliance`: redact + compare).

The seed gives: Signers 59, Readers 43, Compliance 58, Tried AI 21 (developer 15, banker 3, doctor 3), New 19.

### Interview

- The first message is fixed: the AI introduces itself and asks for consent.
- The model may only mention facts from the list; at most 6 questions, then the conversation ends (a system message mid-conversation, without changing the system prompt).
- At the end, a separate call returns `InterviewResult`; `factsUsed` is filtered to IDs that actually exist.
- Through Perplexity: a chat reply takes about 5–6 s, the summary about 13 s.
- Directly through Anthropic: `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`), so if the model refuses a request, the API retries it on another model by itself.

### Write-back to PostHog

After every interview (live and simulated), `ai_interview_completed` is sent with person properties. If PostHog is down, the result is still saved locally and the error goes into `posthogError`. In PostHog: **People → Cohorts → New cohort → Person property `ai_main_reason` contains "trust"** (or `ai_segment = signers`). Filter out simulated ones with `ai_interview_simulated = false`.

### Simulated interviews

40 interviews (`--per 8`) with `--parallel 3` make about 500 model calls; through the hackathon Perplexity account, one interview takes 2–4 minutes. Run them once after the seed, not right before the demo.

### Reason synthesis per group

`GET /api/segments/<id>/synthesis` (or `npm run synthesize`) returns `{ segmentId, themes: [{ title, count, quotes, userIds }], takeaway, basedOn, simulatedCount }`.

- The input is the interviews of people who are in the group now (same rule as the group screen).
- The model only groups into 2–5 themes. `count` is the number of people, computed by code. A quote stays only if it is verbatim from the `quotes` of a person in that theme; otherwise it is dropped.
- The cache is in `data/synthesis/<id>.json`. A new synthesis is made only when the group's results change (a new or repeated interview), and `?force=1` skips the cache. A group without interviews does not call the model.

## Next (phase 2)

Synthesis on the group screen, live refresh, Claude names the groups, AI survey.
