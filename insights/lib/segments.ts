import { daysAgo, getStats, listUserIds, triedAndQuit, type UserStats } from "./facts";
import type { EventCache, Segment } from "./types";

// Razvrstavanje u 5 grupa po PONAŠANJU (ne po ulozi, bez demografije). Grupe pravi kod;
// Claude kasnije (faza 2) samo daje ime i formuliše istraživačko pitanje.

export type SegmentId = "potpisivaci" | "citaci" | "uskladjenost" | "probali_ai" | "novi";

export const SEGMENT_DEFS: Record<SegmentId, Omit<Segment, "userIds">> = {
  potpisivaci: {
    id: "potpisivaci",
    name: "Potpisivači",
    why: "Potpis i formular su više od polovine upotrebe alata.",
    researchQuestion: "Šta im oduzima najviše vremena i zašto ne koriste AI sažetak?",
  },
  citaci: {
    id: "citaci",
    name: "Čitači i pretraživači",
    why: "Pretraga i izvoz u tekst dominiraju, potpisa skoro da nema.",
    researchQuestion: "Šta traže u dokumentima, a ne nalaze?",
  },
  uskladjenost: {
    id: "uskladjenost",
    name: "Usklađenost",
    why: "Zacrnjivanje i poređenje verzija dominiraju.",
    researchQuestion: "Šta im fali u poređenju verzija i zacrnjivanju?",
  },
  probali_ai: {
    id: "probali_ai",
    name: "Probali AI pa odustali",
    why: "AI sažetak korišćen 1 do 2 puta, poslednji put pre više od 14 dana, bez obzira na ulogu.",
    researchQuestion: "Šta nije valjalo sa AI sažetkom kad su ga probali?",
  },
  novi: {
    id: "novi",
    name: "Novi i neaktivni",
    why: "Manje od 10 upotreba alata ili prvi dolazak u poslednjih 7 dana, bez jasnog obrasca.",
    researchQuestion: "Šta su očekivali od alata kad su počeli da ga koriste?",
  },
};

export const SEGMENT_ORDER: SegmentId[] = ["potpisivaci", "citaci", "uskladjenost", "probali_ai", "novi"];

const n = (s: UserStats, f: string) => s.counts[f]?.n ?? 0;

/**
 * Pravila, redom:
 * 1. Probali AI pa odustali (preseca uloge).
 * 2. Novi i neaktivni: malo upotreba ili nov, a nema dominantnog obrasca (>50%).
 *    Nova osoba koja je već jasno potpisivač (npr. demo uživo) ide u Potpisivače.
 * 3. Grupa sa udelom > 50%, inače grupa sa najvećim udelom.
 */
export function classify(s: UserStats, now = Date.now()): { segmentId: SegmentId; why: string } {
  if (triedAndQuit(s, "ai_summary", now)) return { segmentId: "probali_ai", why: SEGMENT_DEFS.probali_ai.why };

  const total = Math.max(1, s.total);
  const shares: [SegmentId, number][] = [
    ["potpisivaci", (n(s, "sign") + n(s, "fill_form")) / total],
    ["citaci", (n(s, "search") + n(s, "export_text")) / total],
    ["uskladjenost", (n(s, "redact") + n(s, "compare")) / total],
  ];
  shares.sort((a, b) => b[1] - a[1]);
  const [topId, topShare] = shares[0];
  const pct = Math.round(topShare * 100);

  const isNew = s.total < 10 || daysAgo(s.firstSeen, now) < 7;
  if (isNew && topShare <= 0.5) return { segmentId: "novi", why: SEGMENT_DEFS.novi.why };
  if (s.total === 0) return { segmentId: "novi", why: SEGMENT_DEFS.novi.why };

  return { segmentId: topId, why: `${SEGMENT_DEFS[topId].why} (${pct}% upotreba)` };
}

export function buildSegments(cache: EventCache, now = Date.now()): Segment[] {
  const byId = new Map<SegmentId, string[]>(SEGMENT_ORDER.map((id) => [id, []]));
  for (const userId of listUserIds(cache)) {
    const s = getStats(cache, userId, now);
    if (s) byId.get(classify(s, now).segmentId)!.push(userId);
  }
  return SEGMENT_ORDER.map((id) => ({ ...SEGMENT_DEFS[id], userIds: byId.get(id)! }));
}
