// Simulirani intervjui za sintezu po grupi. Drugi Claude igra korisnika sa SKRIVENIM razlogom;
// intervjuer je isti kao uživo (lib/interview.ts). Svaki rezultat ima simulated: true.
//
//   npm run simulate -- --per 8                  # 8 po grupi (5 grupa = 40 intervjua)
//   npm run simulate -- --per 1 --segment novi   # brza proba
//   npm run simulate -- --per 8 --no-posthog     # bez upisa u PostHog
//   npm run simulate -- --per 8 --overwrite      # ponovi i za osobe koje već imaju rezultat
//
// Na kraju ispiše koliko često je glavni razlog pogođen (poređenje sa skrivenim razlogom).

import { loadEnv } from "../lib/env";
loadEnv();

const { buildProfile } = await import("../lib/facts");
const { loadCache } = await import("../lib/posthog");
const { buildSegments, segmentDef } = await import("../lib/segments");
const { CONSENT_MESSAGE, nextReply, summarize, MAX_QUESTIONS } = await import("../lib/interview");
const { complete, provider } = await import("../lib/llm");
const { loadInterview, saveInterview } = await import("../lib/store");
type Profile = import("../lib/types").Profile;
type ChatMessage = import("../lib/types").ChatMessage;
type SegmentId = import("../lib/segments").SegmentId;

const arg = (name: string, def: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
};
const PER = Number(arg("per", "8"));
const ONLY = arg("segment", "");
const CONCURRENCY = Number(arg("parallel", "3"));
const SEND = !process.argv.includes("--no-posthog");
const OVERWRITE = process.argv.includes("--overwrite");

// Skriveni razlozi po grupi: raznovrsni, da sinteza ima šta da grupiše. Neke osobe dele razlog.
const HIDDEN: Record<SegmentId, string[]> = {
  potpisivaci: [
    "Ne veruješ AI sažetku za nalaze: ako promaši jednu vrednost, odgovornost je tvoja, pa ionako sve čitaš.",
    "Najviše vremena ti odnosi ručno prepisivanje podataka pacijenta u uput; AI sažetak ti ne rešava to.",
    "Nisi ni znao/la da AI sažetak postoji; dugme ti se nikad nije istaklo.",
    "Bolnička politika ne dozvoljava slanje nalaza u AI alate zbog privatnosti podataka.",
    "Potpisivanje traje jer svaki dokument moraš posebno da otvoriš; želiš da potpišeš više odjednom.",
  ],
  citaci: [
    "Pretraga ne nalazi pojmove u tabelama i skeniranim delovima, pa izvoziš tekst i tražiš u editoru.",
    "Treba ti pretraga kroz više dokumenata odjednom, a Folio traži samo u jednom.",
    "Izvoz u tekst ti kvari formatiranje koda i tabela, pa gubiš vreme na sređivanje.",
    "Probao/la bi AI sažetak, ali želiš odgovore na konkretna pitanja o dokumentu, ne opšti sažetak.",
  ],
  uskladjenost: [
    "Poređenje verzija ne pokazuje izmene u tabelama i brojevima, a tu su najvažnije promene ugovora.",
    "Zacrnjivanje moraš ručno na svakoj strani; želiš automatsko pronalaženje JMBG-a i brojeva računa.",
    "Revizija traži dokaz šta je zacrnjeno i ko je to uradio, a Folio to ne beleži.",
    "Poređenje ne radi kad je jedna verzija sken, pa porediš ručno.",
  ],
  probali_ai: [
    "AI sažetak je izmislio podatak koji nije bio u dokumentu, i od tada mu ne veruješ.",
    "Sažetak je bio previše opšti i dug; brže ti je da sam/a preletiš dokument.",
    "Sažetak je bio na engleskom ili lošem srpskom.",
    "Sporo se učitavao (pola minuta), pa si odustao/la.",
  ],
  novi: [
    "Očekivao/la si jednostavan čitač; previše alata te zbunjuje i ne znaš odakle da kreneš.",
    "Koristiš Folio samo za čitanje skripti; komentari su ti dovoljni i ne treba ti više.",
    "Prešao/la si sa drugog alata i tražiš prečice na koje si navikao/la, a nema ih.",
    "Nemaš puno PDF posla ovog meseca; nije problem u alatu.",
  ],
};

function personaPrompt(profile: Profile, hidden: string) {
  const facts = profile.facts.map((f) => `- ${f.text}`).join("\n");
  return `Igraš korisnika PDF alata Folio u intervjuu koji vodi AI istraživač. Odgovaraš na srpskom (latinica), kao stvarna osoba: kratko (1–3 rečenice), ponekad neprecizno, bez nabrajanja i bez formatiranja.

Tvoja uloga: ${profile.role}.
Šta si zaista radio/la u alatu (ne moraš sve da pominješ):
${facts}

Tvoj pravi razlog (ne izgovaraj ga odmah doslovno; otkrivaj ga postepeno, kad te pitaju pravo pitanje): ${hidden}

Na pristanak odgovori potvrdno. Ne izmišljaj aktivnosti koje se kose sa činjenicama. Ne govori da si AI.`;
}

/** Istorija iz ugla persone: intervjuer je „user“, persona „assistant“. */
function personaTurns(history: ChatMessage[]) {
  return [
    { role: "user" as const, content: CONSENT_MESSAGE },
    ...history.map((m) => ({ role: m.role === "user" ? ("assistant" as const) : ("user" as const), content: m.content })),
  ];
}

async function runOne(profile: Profile, hidden: string) {
  const history: ChatMessage[] = [];
  const persona = personaPrompt(profile, hidden);
  for (let turn = 0; turn <= MAX_QUESTIONS + 1; turn++) {
    const answer = await complete({ instructions: persona, turns: personaTurns(history), maxTokens: 1000, effort: "low" });
    history.push({ role: "user", content: answer });
    const { reply, done } = await nextReply(profile, history);
    history.push({ role: "assistant", content: reply });
    if (done) break;
  }
  const result = await summarize(profile, history, true);
  const record = await saveInterview(result, history, { segmentId: profile.segmentId, hiddenReason: hidden, sendToPosthog: SEND });
  return { result, record, turns: history.length };
}

/** Grubo: da li glavni razlog deli bar dve značajne reči sa skrivenim razlogom. Za brz pregled, nije metrika. */
function roughlyMatches(mainReason: string, hidden: string) {
  const words = (s: string) => new Set(s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").match(/[a-z]{5,}/g) ?? []);
  const a = words(mainReason), b = words(hidden);
  let common = 0;
  for (const w of a) if ([...b].some((x) => x.slice(0, 5) === w.slice(0, 5))) common++;
  return common >= 2;
}

async function main() {
  const cache = loadCache();
  const jobs: { profile: Profile; hidden: string }[] = [];
  for (const seg of buildSegments(cache)) {
    if (ONLY && seg.id !== ONLY) continue;
    const reasons = HIDDEN[seg.id as SegmentId];
    const candidates = seg.userIds.filter((id) => id.startsWith("seed_") && (OVERWRITE || !loadInterview(id)));
    candidates.slice(0, PER).forEach((id, i) => {
      const profile = buildProfile(cache, id);
      if (profile) jobs.push({ profile, hidden: reasons[i % reasons.length] });
    });
  }
  console.log(`Model preko: ${provider()} · ${jobs.length} intervjua · paralelno ${CONCURRENCY} · PostHog: ${SEND ? "da" : "ne"}`);

  let ok = 0, failed = 0, matched = 0;
  const queue = [...jobs];
  async function worker() {
    for (let job = queue.shift(); job; job = queue.shift()) {
      const name = `${job.profile.userId} (${segmentDef(job.profile.segmentId).name})`;
      const t = Date.now();
      try {
        const { result, record, turns } = await runOne(job.profile, job.hidden);
        const hit = roughlyMatches(result.mainReason, job.hidden);
        ok++; if (hit) matched++;
        console.log(`✓ ${name} · ${turns} poruka · ${Math.round((Date.now() - t) / 1000)} s · PostHog: ${record.posthogSentAt ? "da" : "ne"}${hit ? "" : " · razlog se razlikuje"}\n    razlog: ${result.mainReason}\n    skriveno: ${job.hidden}`);
      } catch (e) {
        failed++;
        console.error(`✗ ${name}: ${e instanceof Error ? e.message : e}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, CONCURRENCY) }, worker));
  console.log(`\nGotovo: ${ok} uspešno, ${failed} neuspešno. Glavni razlog grubo pogođen u ${matched}/${ok} (proverite ručno one koji se razlikuju).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
