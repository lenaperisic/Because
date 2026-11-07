# Plan: AI intervjui na PostHog podacima (20h)

Nov 7, 2026 · @Novak

**Pravimo alat koji se kači na PostHog, razvrstava korisnike u grupe po tome kako koriste proizvod i sa svakim vodi AI intervju zasnovan na onome što je zaista radio.** Rezultat se vraća nazad u PostHog, pa produkt tim vidi i šta korisnici rade i zašto.

**Rečenica za pitch:** „PostHog vam kaže šta korisnici rade. Mi ih pitamo zašto, i to svakog o onome što je on uradio.“

**Glavni demo momenat:** član žirija u Folio-u (naš PDF alat) kao lekar potpiše nalaz i popuni uput. Za par sekundi dashboard ga svrsta u grupu, a AI intervju ga pita: „Danas ste potpisali nalaz i popunili uput, ali AI sažetak nikad niste otvorili. Zašto?“ Odgovor se odmah upiše nazad u PostHog kao osobina te osobe.

**Stanje u subotu u 21:30:** Folio je gotov i šalje događaje u PostHog (`feature_used`, `document_opened`), sa opcijom `--user` za novu osobu uživo. Ostalo je oko 13,5 sati: zamrzavanje koda u nedelju u 11:00, pitch oko 14:00. Ako su drugi rokovi, pomerite raspored, ne scope. Ako C i D stižu tek ujutru, A i B ne zavise od njih.

## Scope

Jezgro je jedan tok koji mora da radi do kraja: **PostHog događaji → profil korisnika → grupa → personalizovan intervju → rezultat nazad u PostHog.** Sve ostalo se gradi tek kad taj tok radi.

| Nivo | Šta | Status / rok |
| --- | --- | --- |
| **Gotovo** | Folio PDF alat sa 3 profila, PostHog događaji, `--user` za demo uživo | Urađeno |
| **Mora** | Seed: \~200 korisnika sa Folio događajima u PostHogu | Večeras, do 23:30 |
| **Mora** | Čitanje događaja iz PostHoga preko API-ja + keš | Checkpoint 1 (00:30) |
| **Mora** | Profil korisnika: činjenice o upotrebi alata, računa kod | Checkpoint 1 |
| **Mora** | AI intervju u chatu koji se poziva samo na činjenice | Checkpoint 1 |
| **Mora** | Razvrstavanje u 5 grupa po ponašanju, sa imenom i istraživačkim pitanjem | Checkpoint 2 (09:00) |
| **Mora** | Sažetak intervjua i upis nazad u PostHog | Checkpoint 2 |
| **Mora** | Dashboard: grupe, korisnici, uvidi po grupi, osvežavanje uživo | Checkpoint 2 |
| **Treba** | Sinteza razloga po grupi sa citatima (simulirani intervjui, jasno označeni) | 10:30 |
| **Treba** | AI anketa: 3 personalizovana pitanja umesto chata | 10:30 |
| **Seče se** | Glasovni intervju, slanje mejlom, kreiranje anketa u PostHogu preko API-ja | Samo slajd |
| **Seče se** | Demografija (godine, pol, poreklo) | Nikad: grupe po ponašanju i ulozi |

## Arhitektura

```
Folio (PDF alat) ──događaji──▶ PostHog
PostHog ──HogQL upit──▶ keš (JSON) ──▶ činjenice sa ID-jevima ──▶ pravila ──▶ 5 grupa
grupa + činjenice ──▶ Claude intervju ──▶ strukturisan rezultat
rezultat ──capture + $set──▶ PostHog (ai_segment, ai_main_reason) ──▶ kohorte
```

Jedini deo gde AI odlučuje je intervju (istaknut); sve činjenice o korisniku izračuna kod pre toga, a rezultat se vraća u PostHog kao događaj i osobine osobe.

## Tehnički plan po modulu

**Stack:** Next.js + TypeScript za sve (dashboard, stranica intervjua, API rute), Anthropic SDK za Claude, jedan JSON fajl ili SQLite za stanje. Jedan jezik znači manje integracije u 3 ujutru.

### 1. Čitanje iz PostHoga

Koristimo PostHog query API: `POST /api/projects/:project_id/query/` sa personal API ključem koji ima dozvolu Query Read ([PostHog docs](https://posthog.com/docs/api/queries)). Jedan upit povuče sve što treba za sve korisnike:

```sql
-- upotreba svakog alata po osobi
SELECT distinct_id, properties.feature AS feature, count() AS n,
       min(timestamp) AS first_used, max(timestamp) AS last_used
FROM events
WHERE event = 'feature_used' AND timestamp > now() - INTERVAL 30 DAY
GROUP BY distinct_id, feature
LIMIT 50000

-- uloga i aktivnost po osobi
SELECT distinct_id, any(properties.role) AS role,
       countIf(event = 'document_opened') AS opened, min(timestamp) AS first_seen
FROM events
WHERE timestamp > now() - INTERVAL 30 DAY
GROUP BY distinct_id
LIMIT 50000
```

Ograničenja koja treba poštovati: bez `LIMIT` vraća samo 100 redova, sa `LIMIT` do 50.000; najviše 240 upita u minuti i 3 istovremeno; upit sme da traje 10 sekundi. **Zato rezultat odmah keširamo u fajl** i demo radi nad kešom, a dugme „Osveži iz PostHoga“ povlači ponovo.

### 2. Profil korisnika (bez AI-ja)

Iz redova pravimo profil sa **činjenicama koje je izračunao kod, ne model**: koliko puta je koristio svaki alat, kad prvi i poslednji put, koje alate nikad nije koristio, koje je probao 1 do 2 puta pa prestao (poslednja upotreba starija od 14 dana), najkorišćeniji alat i uloga (`role`). Svaka činjenica dobija ID:

```json
[
  { "id": "f1", "text": "Potpisala 186 dokumenata u poslednjih 30 dana." },
  { "id": "f2", "text": "Popunila 143 formulara." },
  { "id": "f3", "text": "AI sažetak nikad nije otvorila." },
  { "id": "f4", "text": "Danas je otvorila laboratorijski nalaz i potpisala ga." }
]
```

Ovo je najvažniji deo za poverenje: AI sme da se poziva **samo** na ove činjenice, pa ne može da izmisli šta je korisnik radio.

### 3. Razvrstavanje u grupe

1. **Potpisivači:** potpis i formular su više od polovine upotrebe. Pitanje: šta im oduzima najviše vremena i zašto ne koriste AI sažetak.
2. **Čitači i pretraživači:** pretraga i izvoz u tekst dominiraju, potpis skoro nula. Pitanje: šta traže, a ne nalaze.
3. **Usklađenost:** zacrnjivanje i poređenje verzija dominiraju. Pitanje: šta fali u poređenju.
4. **Probali AI pa odustali:** AI sažetak 1 do 2 puta, poslednji put pre više od 14 dana, bez obzira na ulogu. Pitanje: šta nije valjalo.
5. **Novi i neaktivni:** manje od 10 upotreba alata ili prvi dolazak u poslednjih 7 dana. Pitanje: šta su očekivali.

Grupe pravi kod (pravila iznad); Claude samo daje ime i formuliše istraživačko pitanje. Grupa 4 namerno preseca uloge: pokazuje žiriju da grupišemo po ponašanju, a ne po zanimanju. Stretch: k-means nad brojem upotreba po alatu, pa Claude imenuje klastere.

### 4. AI intervju

Stranica `/interview/[userId]`: chat sa Claudeom. System prompt sadrži:

- cilj istraživanja za grupu tog korisnika,
- listu činjenica sa ID-jevima i pravilo da se pominju samo one,
- pravila intervjua: jedno pitanje odjednom, najviše 6 pitanja, bez sugestivnih pitanja, dodatno pitanje kad je odgovor nejasan, ljubazan kraj,
- prva poruka uvek traži pristanak i kaže da razgovor vodi AI.

Na kraju, poseban poziv vraća strukturiran rezultat (JSON preko tool use): `summary`, `main_reason`, `reasons[]`, `quotes[]`, `sentiment`, `suggested_change`, `facts_used[]`.

**AI anketa (treba):** isti kontekst, ali Claude napravi 3 pitanja (2 sa ponuđenim odgovorima, 1 otvoreno) za korisnike koji neće chat.

### 5. Upis nazad u PostHog

Preko capture endpointa sa project tokenom ([PostHog docs](https://posthog.com/docs/api/capture)) šaljemo događaj i postavljamo osobine osobe:

```json
{ "api_key": "<project token>", "event": "ai_interview_completed",
  "distinct_id": "folio_ana_zirij",
  "properties": { "segment": "potpisivaci", "main_reason": "ne veruje AI sažetku nalaza",
    "$set": { "ai_segment": "potpisivaci", "ai_main_reason": "ne veruje AI sažetku nalaza" } } }
```

Posle toga produkt tim u PostHogu može da napravi kohortu „svi kojima je razlog nepoverenje u AI sažetak“ bez ijedne linije koda. To je dokaz da se stvarno kačimo na PostHog, a ne samo čitamo iz njega.

### 6. Dashboard

Tri ekrana: **Grupe** (kartice sa brojem korisnika i istraživačkim pitanjem), **Grupa** (korisnici, status intervjua, sinteza razloga sa citatima), **Korisnik** (činjenice, link za intervju, rezultat). Osvežavanje na par sekundi, da se rezultat pojavi uživo tokom demoa.

## Demo podaci

Demo softver je **Folio**, naš PDF alat sa tri profila (developer, lekar, bankar). Izabran je jer različite uloge koriste **različite alate**, pa se razlika vidi u samim klikovima, ne samo u sadržaju. Folio je gotov i šalje događaje u PostHog.

**Događaji iz Folio-a:** `app_opened`, `profile_switched`, `document_opened` (`doc_kind`, `pages`) i `feature_used` (`feature` = search, annotate, sign, fill\_form, ocr, redact, compare, merge, compress, export\_text ili ai\_summary, plus `doc_kind`). Osoba ima osobinu `role`. Pokretanje uživo: `POSTHOG_KEY=phc_... java -jar folio.jar --profile lekar --user ime`.

| Uloga | Broj | Obrazac za 30 dana | Namerni detalj |
| --- | --- | --- | --- |
| Lekar | 60 | Potpis i formular svaki dan, često OCR i zacrnjivanje | AI sažetak skoro niko |
| Developer | 50 | Pretraga, izvoz u tekst, komentari | 15 je probalo AI sažetak 1 do 2 puta pre 3 nedelje |
| Bankar | 50 | Zacrnjivanje, poređenje, potpis | Trećina redovno koristi AI sažetak |
| Pravnik | 20 | Poređenje i komentari, potpis | Ulazi u grupu Usklađenost zajedno sa bankarima |
| Student | 20 | Čitanje i komentari, malo ukupno | Većina u grupi Novi i neaktivni |

**Seed skripta** (A, oko sat vremena) pravi oko 200 osoba (`seed_lekar_017`...) sa `$identify` + `$set: {role}` i događajima `document_opened` i `feature_used` za poslednjih 30 dana, sa istorijskim `timestamp` i `historical_migration: true` na batch endpointu ([PostHog docs](https://posthog.com/docs/api/capture)). Broj upotreba po alatu = `usage` iz Folio JSON-a za tu ulogu, pomnožen nasumičnim faktorom 0,5 do 1,5, da grupe ne budu savršeno čiste. Skripta upisuje i lokalni JSON kao rezervu ako PostHog zakaže.

**Za sintezu:** pre demoa pustite po 8 do 10 simuliranih intervjua po grupi (drugi Claude igra korisnika sa skrivenim razlogom) i **jasno ih označite kao simulirane**. **Uživo:** član žirija ili D koristi Folio sa `--user`, a tok hvata baš njegove događaje. Večeras izmerite koliko PostHogu treba da nov događaj vrati u upitu; ako kasni više od minut, za demo koristite osobu napravljenu 15 minuta pre pitcha.

## Uloge

Dva SWE člana grade dve polovine jezgra koje se spajaju preko dogovorenih JSON oblika. Druga dvojica rade ono što ih ne blokira: dashboard, kvalitet intervjua i pitch.

| Ko | Zadužen za | Gotovo je kad |
| --- | --- | --- |
| A (tu od početka) | Seed skripta, HogQL upiti i keš, činjenice sa ID-jevima, pravila za grupe, upis rezultata nazad u PostHog | Seed napuni PostHog, a `/api/segments` vrati 5 grupa sa brojem ljudi |
| B (tu od početka) | Claude intervju: prompt, chat ekran, strukturisan rezultat, skripta za simulirane intervjue; grub dashboard dok C ne stigne | Intervju za osobu iz Folio-a navede bar 2 činjenice po ID-u i sačuva rezultat |
| C (stiže ujutru) | Dashboard: grupe, profil osobe, sinteza po grupi, izgled | Žiri za 10 sekundi razume ekran bez objašnjenja |
| D (stiže ujutru) | Pitch i slajdovi, video rezerva, operater demoa uživo sa Folio-om | Pitch staje u vreme, vežan 3 puta, video snimljen |

**21:30–22:00, A i B zajedno: ugovor između delova.** Zapišite tri oblika u repo (`types.ts`) i ne menjajte ih bez dogovora:

```ts
type Fact = { id: string; text: string };
type Profile = { userId: string; role: string; segmentId: string; facts: Fact[] };
type Segment = { id: string; name: string; why: string; researchQuestion: string; userIds: string[] };
type InterviewResult = { userId: string; summary: string; mainReason: string;
  reasons: string[]; quotes: string[]; sentiment: "neg" | "neu" | "pos";
  suggestedChange: string; factsUsed: string[]; simulated: boolean };
```

Sa ovim B može da pravi intervju i grub dashboard nad lažnim JSON-om bez čekanja na A, a C ujutru nastavlja dashboard nad istim oblicima.

## Raspored

Sada je 21:30. Do code freeze-a (11:00) ostaje oko 13,5 sati, do pitcha oko 16,5. Do jutra radite samo vas dvoje, zato C i D nisu na kritičnom putu: ako ne stignu, demo i dalje radi.

| Vreme | A | B | C i D |
| --- | --- | --- | --- |
| 21:30–22:00 | Zajedno: repo, `types.ts`, PostHog projekat i ključevi, Folio šalje događaj koji se vidi u PostHogu | Isto | Pošaljite im plan i Folio zip da pogledaju kod kuće |
| 22:00–00:30 | Seed skripta, HogQL upit, činjenice za jednu osobu | Intervju API, prompt, grub chat ekran | — |
| **00:30** | **Checkpoint 1:** pravi Folio korisnik → činjenice → intervju → sačuvan rezultat | Isto | — |
| 00:30–04:30 | Spava | Grupe, Claude imenuje grupe, grub dashboard, upis nazad u PostHog | — |
| 04:30–08:30 | Simulirani intervjui (8 do 10 po grupi), sinteza po grupi, popravke | Spava | Dolaze kad stignu, čitaju plan |
| **08:30–09:00** | **Checkpoint 2:** svih 5 grupa, sinteza, `ai_main_reason` vidljiv u PostHogu | Isto | Isto |
| 09:00–11:00 | Bagovi, merenje kašnjenja PostHoga | Bagovi, tačnost intervjua | C: izgled dashboarda; D: tekst pitcha, slajdovi |
| **11:00** | **Code freeze** |  |  |
| 11:00–12:00 | Operater za video | Rezervna osoba za demo | D snima video celog toka |
| 12:00–13:30 | Probe pitcha sa tajmerom, bar 3 puta, sa novim `--user` imenom svaki put | Isto | Isto |
| 14:00 | Pitch |  |  |

**Pravila:** šta ne radi na checkpointu, seče se, ne odlaže. Spavanje u smenama nije opciono, jer demo vodi neko ko mora da bude bistar u 14:00. Ako C i D stignu ranije, preuzimaju dashboard i pitch ranije, A i B ne menjaju plan. Posle 11:00 niko ne piše kod.

## Demo i pitch

### Demo tok (oko 3 minuta)

1. **Problem (20 s):** ankete svima postavljaju isto pitanje, odgovara malo ljudi, a odgovori nemaju veze sa onim što je korisnik zaista radio.
2. **Folio uživo:** D ili član žirija pokrene `java -jar folio.jar --profile lekar --user ime`, potpiše nalaz, popuni uput, zacrni JMBG. AI sažetak namerno ne dira.
3. **Dashboard:** osvežite, nova osoba se pojavi u grupi Potpisivači sa svojim činjenicama.
4. **Intervju:** Claude pita na osnovu činjenica, na primer: „Potpisali ste nalaz i popunili uput, ali AI sažetak nikad niste otvorili. Zašto?“ Odgovara član žirija.
5. **Rezultat:** glavni razlog, citat, predlog promene i ID-jevi činjenica koje je Claude koristio.
6. **PostHog:** osoba sada ima `ai_main_reason`, pokažite kohortu napravljenu po tom polju.
7. **Sinteza po grupi:** npr. Probali AI pa odustali, iz simuliranih intervjua, jasno označeno kao simulacija.
8. **Kraj:** kome ovo treba (produktni timovi koji već imaju PostHog) i šta je sledeći korak.

**Rezerve:** ako PostHog kasni, koristite osobu napravljenu 15 minuta pre pitcha; ako padne internet, pustite video.

### Pitch po kriterijumima žirija

| Kriterijum | Šta pokažemo ili kažemo |
| --- | --- |
| Team & Execution | „Ovo smo izgradili za 18 sati, od čega je jedan tok potpuno ugrađen u pravi PostHog.“ |
| Technical Complexity | Činjenice računa kod, ne model; AI sme da pomene samo njih. Rezultat se upisuje nazad u PostHog. |
| Is It Something People Want | Citati sa razgovora sa mentorima i sponzorima. Bar jedan konkretan: „imamo podatke, nemamo zašto“. |
| Originality | Intervju vođen ponašanjem, ne generička anketa. Radi nad analitikom koju tim već ima. |
| Ambition | Prvo PostHog, posle Amplitude i Mixpanel. Vizija: istraživanje korisnika koje radi samo, stalno, za svaku grupu. |
| Demo & Presentation | Intervju uživo sa žirijem, rezultat odmah u PostHogu. |

### Teška pitanja koja će doći

- **„PostHog već ima ankete, Sprig ima AI agente za istraživanje, Listen Labs vodi AI intervjue.“** Odgovor: oni pitaju ono što im zadate. Mi sami nalazimo koga treba pitati i postavljamo pitanje zasnovano na onome što je ta osoba uradila. Iskreno: ovo je najslabija tačka, pa je odgovor vredno uvežbati.
- **„Šta ako AI izmisli šta je korisnik radio?“** Ne može: činjenice računa kod i AI ih pominje po ID-ju, a u rezultatu piše koje je koristio.
- **„Zašto bi korisnik pristao na razgovor sa AI-jem?“** Pristanak je prvi korak, intervju traje 2 do 3 minuta, a pitanje je o njegovom iskustvu, ne generičko. Proverite sa mentorima kakav je odziv realan.
- **„Privatnost?“** Grupe su po ponašanju i ulozi, bez demografije. Korisnik zna da razgovara sa AI-jem i može da odbije.

## Rizici i rezervni planovi

| Rizik | Rezervni plan |
| --- | --- |
| PostHog upit spor ili 429 (limit upita) | Keš u fajlu posle prvog upita; demo radi nad kešom, osvežavanje samo na dugme |
| Novi događaji kasne u PostHogu | Seed pustiti večeras, ne ujutru. Za demo upis nazad proveriti bar 30 minuta ranije |
| AI pominje nešto što korisnik nije radio | Samo činjenice sa ID-jevima u promptu; u rezultatu `factsUsed`; D testira namerno zbunjujuće odgovore |
| Intervju predug ili dosadan | Najviše 6 pitanja, jedno pitanje po poruci, kraj sa zahvalom i sažetkom |
| Pravila za grupe daju prazne ili ogromne grupe | Seed je napravljen za pravila; proveriti brojeve na checkpointu 1 |
| Intervju uživo ode u čudnom pravcu | D ima pripremljen scenario korisnika; rezervni video celog toka |
| Žiri pomisli da su svi rezultati lažni | Oznaka „simulirano“ na svakom simuliranom rezultatu, jedan intervju uživo |
| Nema interneta ili Anthropic API zakaže | Snimljen video do 12:00, keširani odgovori za scenario |
| Umor posle 03:00 | Smene iz rasporeda se poštuju. Niko ne radi na delu koji nije njegov posle ponoći |

## Izvori

- [PostHog: Query API](https://posthog.com/docs/api/queries)
- [PostHog: Capture API](https://posthog.com/docs/api/capture)
- [PostHog: Surveys API](https://posthog.com/docs/api/surveys)
- [PostHog Surveys](https://posthog.com/surveys)
- [Sprig: The future of AI and user insights](https://sprig.com/blog/the-future-of-ai-and-user-insights-at-sprig)
- [Dealroom: Listen Labs](https://dealroom.co/news/143721-listen-labs-targets-125m-series-c-at-1-5b-valuation/)
