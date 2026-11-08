# Because (insights) · AI intervjui na PostHog podacima

Faza 1 iz `../plan-ai-intervjui.md` (Checkpoint 1): **PostHog događaji → profil sa činjenicama → grupa → AI intervju → sačuvan rezultat.**

## Podešavanje

```
npm install
cp .env.example .env.local   # popunite ključeve
```

| Promenljiva | Čemu služi |
| --- | --- |
| `PERPLEXITY_API_KEY` | Claude preko Perplexity Agent API-ja (hakaton krediti). Ako postoji, ima prednost. |
| `ANTHROPIC_API_KEY` | Claude direktno, kad nema Perplexity ključa (`INTERVIEW_MODEL`, podrazumevano `claude-opus-5-5`) |
| `POSTHOG_KEY`, `POSTHOG_HOST` | Project token (`phc_...`): seed (i kasnije upis nazad) |
| `POSTHOG_PERSONAL_KEY`, `POSTHOG_PROJECT_ID`, `POSTHOG_API_HOST` | Personal key sa **Query Read**: čitanje događaja |

## Tok

```
npm run seed                      # ~200 osoba, ~100k događaja za 30 dana -> PostHog + data/seed-backup.json
npm run seed -- --dry-run         # samo lokalna rezerva, bez PostHoga
npm run fetch                     # HogQL -> data/cache.json, ispiše broj ljudi po grupi
npm run fetch -- --local          # isto, nad postojećim kešom ili seed rezervom
npm run facts -- seed_lekar_017   # činjenice sa ID-jevima i grupa za jednu osobu
npm run simulate -- --per 8       # simulirani intervjui, 8 po grupi (simulated: true), upis u PostHog
npm run simulate -- --per 1 --segment novi --no-posthog   # brza proba
npm run synthesize                # sinteza razloga po grupi (Claude) -> data/synthesis/<grupa>.json
npm run name-segments             # Claude daje ime i istraživačko pitanje grupama -> data/segment-names.json (i dugme na početnoj)
npm run dev                       # http://localhost:3000
```

Demo uživo: `POSTHOG_KEY=phc_... java -jar ../folio/folio/folio.jar --profile lekar --user "Ana Zirij"` šalje događaje kao osoba `folio_ana_zirij`. Zatim „Osveži iz PostHoga“ na početnoj, ili direktno `/interview/folio_ana_zirij` (ako osobe nema u kešu, stranica sama povuče ponovo).

Bez PostHog ključeva aplikacija radi nad `data/seed-backup.json`.

## Delovi

| Fajl | Šta radi |
| --- | --- |
| `lib/types.ts` | Ugovor između delova (`Fact`, `Profile`, `Segment`, `InterviewResult`). Ne menjati bez dogovora. |
| `lib/posthog.ts` | 3 HogQL upita (upotreba po alatu, osoba, današnja aktivnost), jedan po jedan, keš u `data/cache.json` |
| `lib/facts.ts` | Činjenice sa ID-jevima; računa ih kod, ne model |
| `lib/segments.ts` | Pravila za 5 grupa po ponašanju |
| `lib/interview.ts` | System prompt, chat poziv, strukturisan rezultat (JSON šema iz zod-a) |
| `lib/llm.ts` | Jedan poziv modela: Perplexity `/v1/agent` (`anthropic/claude-opus-5-5`, `tool_choice: none` = bez web pretrage) ili Anthropic direktno |
| `lib/store.ts` | Rezultati u `data/results/<userId>.json`, pa upis u PostHog |
| `lib/capture.ts` | Upis nazad: događaj `ai_interview_completed` + `$set` (`ai_segment`, `ai_main_reason`, `ai_sentiment`, `ai_suggested_change`, `ai_interview_simulated`, `ai_interviewed_at`) |
| `lib/synthesis.ts` | Sinteza razloga po grupi: jedan poziv modela grupiše intervjue u teme; broj osoba i citate proverava kod |
| `scripts/simulate.ts` | Drugi Claude igra korisnika sa skrivenim razlogom; na kraju poredi pogođen razlog sa skrivenim |
| `scripts/synthesize.ts` | Ispiše sintezu za sve grupe (`--segment <id>`, `--force`) |
| `app/segment/[id]` | Ekran grupe: korisnici, status intervjua, razlozi sa citatima |
| `app/interview/[userId]` | Chat ekran + činjenice sa strane |
| `app/api/*` | `refresh`, `segments`, `segments/[id]/synthesis`, `profile/[userId]`, `interview`, `interview/finish` |

### Pravila za grupe

1. **Probali AI pa odustali:** AI sažetak 1–2 puta, poslednji put pre više od 14 dana (preseca uloge).
2. **Novi i neaktivni:** < 10 upotreba ili prvi dolazak u poslednjih 7 dana, *a nema dominantnog obrasca* (> 50%). Nova osoba koja već jasno potpisuje (demo uživo) ide u Potpisivače.
3. Inače grupa sa najvećim udelom: **Potpisivači** (potpis + formular), **Čitači** (pretraga + izvoz u tekst), **Usklađenost** (zacrnjivanje + poređenje).

Seed daje: Potpisivači 59, Čitači 43, Usklađenost 58, Probali AI 21 (developer 15, bankar 3, lekar 3), Novi 19.

### Intervju

- Prva poruka je fiksna: AI se predstavlja i traži pristanak.
- Model sme da pominje samo činjenice iz liste; najviše 6 pitanja, pa se razgovor završava (sistemska poruka usred razgovora, bez promene system prompta).
- Na kraju poseban poziv vraća `InterviewResult`; `factsUsed` se filtrira na ID-jeve koji stvarno postoje.
- Preko Perplexity-ja: odgovor u chatu oko 5–6 s, sažetak oko 13 s.
- Direktno preko Anthropic-a: `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`), pa ako model odbije zahtev, API ga sam ponovi na drugom modelu.

### Upis nazad u PostHog

Posle svakog intervjua (uživo i simuliranog) šalje se `ai_interview_completed` sa osobinama osobe. Ako PostHog ne radi, rezultat se ipak sačuva lokalno, a greška se upiše u `posthogError`. U PostHogu: **People → Cohorts → New cohort → Person property `ai_main_reason` contains „veruje“** (ili `ai_segment = potpisivaci`). Simulirane izbacite filterom `ai_interview_simulated = false`.

### Simulirani intervjui

40 intervjua (`--per 8`) traje oko 8 minuta sa `--parallel 3` i troši oko 500 poziva modela. Pustite ih jednom posle seeda, a ne pred demo.

### Sinteza razloga po grupi

`GET /api/segments/<id>/synthesis` (ili `npm run synthesize`) vraća `{ segmentId, themes: [{ title, count, quotes, userIds }], takeaway, basedOn, simulatedCount }`.

- Ulaz su intervjui osoba koje su sada u grupi (isto pravilo kao ekran grupe).
- Model samo grupiše u 2–5 tema. `count` je broj osoba koji računa kod. Citat ostaje samo ako je doslovno iz `quotes` osobe iz te teme, inače se izbacuje.
- Keš je u `data/synthesis/<id>.json`. Nova sinteza se pravi tek kad se rezultati grupe promene (nov ili ponovljen intervju), a `?force=1` preskače keš. Grupa bez intervjua ne zove model.

## Sledeće (faza 2)

Sinteza na ekranu grupe, osvežavanje uživo, Claude imenuje grupe, AI anketa.
