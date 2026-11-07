# Insights · AI intervjui na PostHog podacima

Faze 1 i 2 iz `../plan-ai-intervjui.md`: **PostHog događaji → profil sa činjenicama → grupa → AI intervju → rezultat nazad u PostHog → dashboard i sinteza po grupi.**

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
npm run name-segments             # (opciono) Claude imenuje grupe i formuliše pitanja -> data/segment-names.json
npm run simulate -- --synthesize  # 8 simuliranih intervjua po grupi + sinteza (jasno označeno „simulirano“)
npm run simulate -- --per 3 --segment probali_ai --no-posthog
npm run synthesize                # sinteza razloga po grupi iz svih sačuvanih intervjua
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
| `lib/store.ts` | Rezultati u `data/results/<userId>.json`, sinteze u `data/synthesis/<grupa>.json` |
| `lib/capture.ts` | Upis nazad u PostHog: `ai_interview_completed` + `$set` (`ai_segment`, `ai_main_reason`, `ai_sentiment`, `ai_suggested_change`, `ai_interview_simulated`) |
| `lib/finish.ts` | Kraj intervjua (pravog ili simuliranog): sažetak → čuvanje → PostHog |
| `lib/naming.ts` | Claude daje ime i istraživačko pitanje grupama iz zbirnih brojeva (članstvo ostaje po pravilima) |
| `lib/simulate.ts` | Simulirani korisnik sa skrivenim razlogom (po grupi) protiv pravog intervjuera |
| `lib/synthesis.ts` | Teme sa citatima po grupi; broj po temi i citate proverava kod |
| `app/page.tsx` | Ekran **Grupe**: kartice, mešavina uloga, intervjui, uvid; traka „Uživo iz Folio-a“ |
| `app/segment/[id]` | Ekran **Grupa**: sinteza sa citatima i predlozima, tabela korisnika sa statusom i PostHog upisom |
| `app/interview/[userId]` | Ekran **Korisnik**: chat + činjenice + rezultat i status upisa u PostHog |
| `app/api/*` | `refresh`, `segments`, `segments/name`, `profile/[userId]`, `interview`, `interview/finish`, `synthesis/[segmentId]` |

Dashboard se sam osvežava na 4 s (novi rezultati); prekidač „PostHog na 30 s“ povlači i nove događaje, pa se osoba iz Folio-a pojavi bez klika.

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

Posle svakog intervjua ide `POST {POSTHOG_HOST}/i/v0/e/` sa project tokenom. Ako PostHog zakaže, rezultat ostaje sačuvan, a greška se vidi na stranici. U PostHogu: Persons → filter `ai_main_reason` → Save as cohort. Simulirani intervjui imaju `ai_interview_simulated = true` (isključite ih iz kohorte tim filterom ili pokrenite simulaciju sa `--no-posthog`).

## Sledeće

AI anketa (3 personalizovana pitanja umesto chata); izgled dashboarda (C).
