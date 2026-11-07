import Link from "next/link";
import { notFound } from "next/navigation";
import { loadCache } from "@/lib/posthog";
import { buildSegments } from "@/lib/segments";
import { listInterviews } from "@/lib/store";
import type { InterviewResult } from "@/lib/types";

export const dynamic = "force-dynamic";

// Ekran grupe: ko je u grupi, ko je intervjuisan i koji glavni razlozi se ponavljaju.
// Razloge ovde grupiše kod (isti glavni razlog), bez AI-ja.

const SENTIMENT: Record<string, string> = { neg: "negativan", neu: "neutralan", pos: "pozitivan" };
/** Glavni razlog kad korisnik nije dao razlog (lib/interview.ts); u listi razloga ide poslednji. */
const NO_REASON = "nije naveden razlog";
const QUOTES_PER_REASON = 2;

type Quote = { text: string; userId: string; simulated: boolean };
type ReasonGroup = { key: string; label: string; count: number; simulated: number; quotes: Quote[] };

const isSeed = (id: string) => id.startsWith("seed_");
const interviewHref = (id: string) => `/interview/${encodeURIComponent(id)}`;

/** 1 osoba, 2 osobe, 5 osoba, 22 osobe. */
function personCount(n: number) {
  const few = n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14);
  return `${n} ${few ? "osobe" : "osoba"}`;
}

/** Jedan razmak, bez tačke na kraju. */
const tidy = (s: string) => s.trim().replace(/\s+/g, " ").replace(/[.!…]+$/u, "");
/** Ključ za grupisanje: isti razlog bez obzira na velika slova i tačku na kraju. */
const reasonKey = (s: string) => tidy(s).toLowerCase();

/** Parovi navodnika kojima model ponekad obavije ceo citat. */
const QUOTE_PAIRS = ["„“", "„”", "“”", "«»", "»«", '""'];

/** Citat bez navodnika, samo ako je njima obavijen ceo citat; navodnike unutar citata ne dira. */
function cleanQuote(q: string) {
  const t = q.trim();
  const open = t.charAt(0), close = t.charAt(t.length - 1), inner = t.slice(1, -1);
  const wrapped = t.length >= 2 && QUOTE_PAIRS.includes(open + close) && !inner.includes(open) && !inner.includes(close);
  return wrapped ? inner.trim() : t;
}

/** Do `max` citata: prvo iz pravih intervjua, po jedan od svake osobe, bez ponavljanja. */
function pickQuotes(results: InterviewResult[], max: number): Quote[] {
  const ordered = [...results].sort((a, b) => Number(!!a.simulated) - Number(!!b.simulated));
  const longest = Math.max(0, ...ordered.map((r) => r.quotes?.length ?? 0));
  const out: Quote[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < longest && out.length < max; i++) {
    for (const r of ordered) {
      const text = cleanQuote(r.quotes?.[i] ?? "");
      if (!text || seen.has(text)) continue;
      seen.add(text);
      out.push({ text, userId: r.userId, simulated: !!r.simulated });
      if (out.length >= max) break;
    }
  }
  return out;
}

/** Isti glavni razlog = ista stavka. Redom po broju osoba, a „nije naveden razlog“ na kraju. */
function groupReasons(results: InterviewResult[]): ReasonGroup[] {
  const byKey = new Map<string, InterviewResult[]>();
  for (const r of results) {
    const key = reasonKey(r.mainReason || "") || NO_REASON;
    byKey.set(key, [...(byKey.get(key) ?? []), r]);
  }
  return [...byKey]
    .map(([key, rs]) => {
      // Tekst stavke: kako ga je zapisao pravi intervju, ako ga ima.
      const text = key === NO_REASON ? NO_REASON : tidy((rs.find((r) => !r.simulated) ?? rs[0]).mainReason);
      return {
        key,
        label: text.charAt(0).toUpperCase() + text.slice(1),
        count: rs.length,
        simulated: rs.filter((r) => r.simulated).length,
        quotes: pickQuotes(rs, QUOTES_PER_REASON),
      };
    })
    .sort((a, b) =>
      Number(a.key === NO_REASON) - Number(b.key === NO_REASON) ||
      b.count - a.count ||
      a.simulated - b.simulated ||
      a.label.localeCompare(b.label));
}

export default async function SegmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cache = loadCache();
  const segment = buildSegments(cache).find((s) => s.id === id);
  if (!segment) notFound();

  const members = new Set(segment.userIds);
  const peopleById = new Map(cache.people.map((p) => [p.distinct_id, p]));
  const results = new Map<string, InterviewResult>();
  for (const record of listInterviews()) {
    if (members.has(record.result.userId)) results.set(record.result.userId, record.result);
  }
  const done = [...results.values()];
  const simulated = done.filter((r) => r.simulated).length;
  const reasons = groupReasons(done);
  // Prave Folio osobe (ne seed) prve, pa intervjuisani, pa po ID-ju.
  const rows = [...segment.userIds].sort((a, b) =>
    Number(isSeed(a)) - Number(isSeed(b)) ||
    Number(!results.has(a)) - Number(!results.has(b)) ||
    a.localeCompare(b));

  return (
    <main>
      <p className="muted"><Link href="/">← Grupe</Link></p>
      <h1>{segment.name} <span className="pill">{personCount(segment.userIds.length)}</span></h1>
      <p><b>Istraživačko pitanje:</b> {segment.researchQuestion}</p>
      <p className="muted">{segment.why}</p>
      <p>
        Intervjuisano <b>{done.length} od {segment.userIds.length}</b>
        {simulated > 0 && <span className="muted"> (simulirano: {simulated})</span>}
      </p>
      <div className="split">
        <section className="card table-card">
          <h2>Korisnici</h2>
          {rows.length === 0 ? (
            <p className="muted">U ovoj grupi trenutno nema nikoga.</p>
          ) : (
            <div className="table-wrap">
              <table className="people">
                <thead>
                  <tr><th>Osoba</th><th>Ime</th><th>Uloga</th><th>Intervju</th><th>Glavni razlog</th><th>Ton</th></tr>
                </thead>
                <tbody>
                  {rows.map((userId) => {
                    const person = peopleById.get(userId);
                    const r = results.get(userId);
                    return (
                      <tr key={userId}>
                        <td>
                          <Link href={interviewHref(userId)}>{userId}</Link>
                          {!isSeed(userId) && <> <span className="pill">uživo</span></>}
                        </td>
                        <td>{person?.name || "—"}</td>
                        <td>{person?.role || "—"}</td>
                        <td className="nowrap">
                          {r ? <>✓{r.simulated && <> <span className="pill">simulirano</span></>}</> : <span className="muted">—</span>}
                        </td>
                        <td>{r?.mainReason}</td>
                        <td>{r && (SENTIMENT[r.sentiment] ?? r.sentiment)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <aside className="card">
          <h2>Razlozi</h2>
          {reasons.length === 0 ? (
            <p className="muted">Još nema intervjua u ovoj grupi. Otvorite osobu iz tabele i pokrenite intervju.</p>
          ) : (
            <>
              <p className="muted">Glavni razlozi iz intervjua, grupisani kodom po istom tekstu (bez AI-ja).</p>
              <ul className="reasons">
                {reasons.map((g) => (
                  <li key={g.key}>
                    <b>{g.label}</b> <span className="pill">{personCount(g.count)}</span>
                    {g.simulated > 0 && (
                      <> <span className="pill">{g.simulated === g.count ? "simulirano" : `simulirano: ${g.simulated}`}</span></>
                    )}
                    {g.quotes.map((q) => (
                      <blockquote key={`${q.userId}|${q.text}`} className="quote">
                        „{q.text}“ <span className="muted">— <Link href={interviewHref(q.userId)}>{q.userId}</Link></span>
                        {q.simulated && <> <span className="pill">simulirano</span></>}
                      </blockquote>
                    ))}
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>
      </div>
    </main>
  );
}
