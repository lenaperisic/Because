import { FEATURES, label } from "./features";
import { classify } from "./segments";
import type { EventCache, Fact, Profile, TodayRow } from "./types";

// Profil korisnika: činjenice koje računa KOD, ne model. AI sme da se poziva samo na njih.

const DAY = 24 * 3600 * 1000;
/** Probao pa prestao: 1–2 upotrebe, poslednja starija od ovoliko dana. */
export const QUIT_AFTER_DAYS = 14;

export type FeatureStat = { n: number; first: string; last: string };

export type UserStats = {
  userId: string;
  role: string;
  name: string;
  counts: Record<string, FeatureStat>;
  /** Ukupno upotreba alata (feature_used), bez otvaranja dokumenata. */
  total: number;
  opened: number;
  firstSeen: string;
  lastSeen: string;
  today: TodayRow[];
};

export function listUserIds(cache: EventCache): string[] {
  return cache.people.map((p) => p.distinct_id).sort();
}

export function getStats(cache: EventCache, userId: string, now = Date.now()): UserStats | null {
  const person = cache.people.find((p) => p.distinct_id === userId);
  const usage = cache.usage.filter((u) => u.distinct_id === userId);
  if (!person && usage.length === 0) return null;
  const counts: Record<string, FeatureStat> = {};
  for (const u of usage) {
    if (!u.feature) continue;
    counts[u.feature] = { n: u.n, first: u.first_used, last: u.last_used };
  }
  const total = Object.values(counts).reduce((s, c) => s + c.n, 0);
  const firstSeen = person?.first_seen || minIso(usage.map((u) => u.first_used)) || new Date(now).toISOString();
  return {
    userId,
    role: person?.role ?? "",
    name: person?.name ?? "",
    counts,
    total,
    opened: person?.opened ?? 0,
    firstSeen,
    lastSeen: person?.last_seen ?? "",
    today: cache.today.filter((t) => t.distinct_id === userId),
  };
}

export function daysAgo(isoDate: string, now = Date.now()): number {
  return Math.max(0, Math.floor((startOfDay(now) - startOfDay(Date.parse(isoDate))) / DAY));
}

/** Probao alat 1–2 puta pa prestao (poslednja upotreba starija od 14 dana). */
export function triedAndQuit(s: UserStats, feature: string, now = Date.now()): boolean {
  const c = s.counts[feature];
  return !!c && c.n >= 1 && c.n <= 2 && daysAgo(c.last, now) > QUIT_AFTER_DAYS;
}

export function buildFacts(s: UserStats, now = Date.now()): Fact[] {
  const texts: string[] = [];

  if (s.role) texts.push(`Uloga u Folio-u: ${s.role}.`);

  // Današnja aktivnost (najvažnije za pitanje „danas ste...“).
  // Po jedna činjenica po alatu, sa vrstama dokumenata na kojima je korišćen.
  const usedToday = groupToday(s.today.filter((t) => t.event === "feature_used" && t.feature), (t) => t.feature);
  for (const [f, g] of usedToday) {
    texts.push(`Danas: ${label(f)} ${times(g.n)}${g.kinds.length ? ` (dokumenti: ${g.kinds.join(", ")})` : ""}.`);
  }
  const openedToday = groupToday(s.today.filter((t) => t.event === "document_opened"), () => "opened");
  for (const [, g] of openedToday) {
    texts.push(`Danas otvoreno dokumenata: ${g.n}${g.kinds.length ? ` (${g.kinds.join(", ")})` : ""}.`);
  }

  // Upotreba svakog alata u poslednjih 30 dana.
  const used = Object.entries(s.counts).filter(([, c]) => c.n > 0).sort((a, b) => b[1].n - a[1].n);
  for (const [f, c] of used) {
    if (triedAndQuit(s, f, now)) {
      texts.push(`${label(f)}: korišćen samo ${times(c.n)}, poslednji put ${when(c.last, now)}, od tada nijednom.`);
    } else {
      texts.push(`${label(f)}: ${times(c.n)} u poslednjih 30 dana, poslednji put ${when(c.last, now)}.`);
    }
  }

  if (used.length && s.total > 0) {
    const [topF, topC] = used[0];
    texts.push(`Najkorišćeniji alat: ${label(topF)} (${Math.round((100 * topC.n) / s.total)}% svih upotreba alata).`);
  }

  const never = FEATURES.filter((f) => !s.counts[f] || s.counts[f].n === 0);
  if (never.length) texts.push(`Nijednom korišćeno u poslednjih 30 dana: ${never.map(label).join(", ")}.`);

  if (s.opened > 0) texts.push(`Otvorenih dokumenata u poslednjih 30 dana: ${s.opened}.`);
  texts.push(`Ukupno upotreba alata u poslednjih 30 dana: ${s.total}.`);

  const firstDays = daysAgo(s.firstSeen, now);
  if (firstDays < 7) texts.push(`Prvi put u Folio-u: ${when(s.firstSeen, now)}.`);

  return texts.map((text, i) => ({ id: `f${i + 1}`, text }));
}

export function buildProfile(cache: EventCache, userId: string, now = Date.now()): Profile | null {
  const s = getStats(cache, userId, now);
  if (!s) return null;
  return { userId, role: s.role, segmentId: classify(s, now).segmentId, facts: buildFacts(s, now) };
}

// ---- pomoćno ----

function startOfDay(t: number) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Sabere današnje redove po ključu; vrste dokumenata poređa od najčešće. */
function groupToday(rows: TodayRow[], key: (t: TodayRow) => string) {
  const m = new Map<string, { n: number; kinds: Map<string, number> }>();
  for (const t of rows) {
    const g = m.get(key(t)) ?? { n: 0, kinds: new Map() };
    g.n += t.n;
    if (t.doc_kind) g.kinds.set(t.doc_kind, (g.kinds.get(t.doc_kind) ?? 0) + t.n);
    m.set(key(t), g);
  }
  return [...m]
    .sort((a, b) => b[1].n - a[1].n)
    .map(([k, g]) => [k, { n: g.n, kinds: [...g.kinds].sort((a, b) => b[1] - a[1]).map(([kind]) => kind) }] as const);
}

function minIso(xs: string[]) {
  return xs.filter(Boolean).sort()[0];
}

/** 1 put, 2 puta, 5 puta, 21 put. */
export function times(n: number) {
  return `${n} ${n % 10 === 1 && n % 100 !== 11 ? "put" : "puta"}`;
}

/** danas, juče, pre 3 dana, pre 21 dan. */
export function when(isoDate: string, now = Date.now()) {
  const d = daysAgo(isoDate, now);
  if (d === 0) return "danas";
  if (d === 1) return "juče";
  return `pre ${d} ${d % 10 === 1 && d % 100 !== 11 ? "dan" : "dana"}`;
}
