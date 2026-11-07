import { CONSENT_MESSAGE, MAX_QUESTIONS, nextReply } from "./interview";
import { complete } from "./llm";
import type { SegmentId } from "./segments";
import type { ChatMessage, Profile } from "./types";

// Simulirani intervju: drugi Claude igra korisnika sa SKRIVENIM razlogom, a naš intervjuer
// ga ispituje kao pravog korisnika. Služi samo za sintezu po grupi pre demoa i uvek je
// označen kao simuliran (result.simulated = true, oznaka u dashboardu i u PostHogu).

/** Skriveni razlozi po grupi; simulirani korisnik dobije jedan i ne sme da ga kaže odmah. */
export const HIDDEN_REASONS: Record<SegmentId, string[]> = {
  potpisivaci: [
    "Ne veruješ AI sažetku medicinskih/finansijskih nalaza: bojiš se da će izostaviti bitan detalj, a ti potpisuješ i odgovaraš.",
    "Nemaš vremena: potpisuješ desetine dokumenata dnevno i svaki dodatni klik ti smeta; najviše vremena ti oduzima ponovno unošenje istih podataka u formulare.",
    "Nisi ni znao/la da AI sažetak postoji; dugme ti nikad nije zapalo za oko.",
    "Pravila ustanove ne dozvoljavaju slanje dokumenata sa ličnim podacima AI-ju.",
    "Najviše vremena ti oduzima potpisivanje jednog po jednog dokumenta; želiš grupno potpisivanje.",
  ],
  citaci: [
    "Pretraga ne nalazi tekst u skeniranim dokumentima dok ručno ne pokreneš OCR.",
    "Pretraga traži samo tačne reči; tražiš pojmove i sinonime, npr. 'timeout' a u dokumentu piše 'isteklo vreme'.",
    "Izvoz u tekst gubi tabele i formatiranje koda, pa sve kopiraš ručno.",
    "Ne možeš da pretražuješ više dokumenata odjednom, nego otvaraš jedan po jedan.",
  ],
  uskladjenost: [
    "Poređenje verzija ne prikazuje izmene u tabelama i brojevima, samo u tekstu.",
    "Zacrnjivanje je ručno: moraš da označiš svaki JMBG/broj računa posebno, nema automatskog prepoznavanja.",
    "Nema zapisa ko je šta zacrnio i kada, a revizija to traži.",
    "Poređenje ne radi kad je jedna verzija skenirana, a druga digitalna.",
  ],
  probali_ai: [
    "AI sažetak je izmislio podatak kojeg nema u dokumentu, i od tada mu ne veruješ.",
    "Sažetak je bio previše opšti i dugačak; nije ti uštedeo vreme u odnosu na letimično čitanje.",
    "Sažetak je bio spor (čekao/la si dugo) pa si odustao/la.",
    "Sažetak je bio na engleskom ili lošem srpskom, a dokumenti su na srpskom.",
  ],
  novi: [
    "Očekivao/la si da Folio automatski uveze dokumente iz mejla, a moraš ručno.",
    "Samo povremeno treba da pročitaš neki PDF; ne treba ti više od toga.",
    "Interfejs ti je delovao komplikovano i nisi znao/la odakle da počneš.",
    "Kolega ti je preporučio Folio zbog potpisa, ali još nisi imao/la šta da potpišeš.",
  ],
};

function personaPrompt(profile: Profile, hiddenReason: string) {
  const facts = profile.facts.map((f) => `- ${f.text}`).join("\n");
  return `Igraš korisnika PDF alata Folio u intervjuu sa AI istraživačem. Ovo je simulacija za testiranje, ali odgovaraj kao stvarna osoba.

Tvoja uloga: ${profile.role || "korisnik"}.
Šta si zaista radio/la u alatu (poslednjih 30 dana):
${facts}

Tvoj pravi razlog (SKRIVEN): ${hiddenReason}

Pravila:
- Piši na srpskom (latinica), kratko i prirodno: 1 do 3 rečenice, ponekad nepotpuno ili neodređeno, kao pravi korisnik koji žuri.
- Na pozdrav pristani u par reči.
- Pravi razlog ne govori odmah ni doslovno; otkrivaj ga postepeno kad te pitaju, svojim rečima, sa jednim konkretnim primerom iz svog posla.
- Ne izmišljaj aktivnosti koje nisu u listi iznad.
- Ne pominji da si AI ili da je ovo simulacija.`;
}

/** Odgovor simuliranog korisnika: intervjuer je za njega „user“, a on sam „assistant“. */
async function personaReply(profile: Profile, hiddenReason: string, history: ChatMessage[]): Promise<string> {
  const flipped = [
    { role: "user" as const, content: CONSENT_MESSAGE },
    ...history.map((m) => ({ role: m.role === "assistant" ? ("user" as const) : ("assistant" as const), content: m.content })),
  ];
  return complete({ instructions: personaPrompt(profile, hiddenReason), turns: flipped, maxTokens: 1500, effort: "low" });
}

/** Ceo simulirani razgovor; vraća transkript (bez fiksnog pozdrava, kao i pravi chat). */
export async function simulateConversation(profile: Profile, hiddenReason: string): Promise<ChatMessage[]> {
  const history: ChatMessage[] = [];
  for (let turn = 0; turn <= MAX_QUESTIONS + 1; turn++) {
    history.push({ role: "user", content: await personaReply(profile, hiddenReason, history) });
    const { reply, done } = await nextReply(profile, history);
    history.push({ role: "assistant", content: reply });
    if (done) break;
  }
  return history;
}
