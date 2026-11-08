import Link from "next/link";
import { notFound } from "next/navigation";
import { NO_REASON } from "@/lib/interview";
import { loadCache } from "@/lib/posthog";
import { isSample } from "@/lib/sample";
import { buildSegments } from "@/lib/segments";
import { listInterviews } from "@/lib/store";
import type { InterviewResult } from "@/lib/types";
import AutoRefresh from "../../AutoRefresh";
import { cleanQuote, personCount } from "./format";
import Synthesis from "./Synthesis";

export const dynamic = "force-dynamic";

// Group screen: who is in the group, who was interviewed and which main reasons repeat.
// The client fetches the synthesis (Claude) after loading; "Reasons" on the right is grouped by code, no AI.

const SENTIMENT: Record<string, string> = { neg: "negative", neu: "neutral", pos: "positive" };
const QUOTES_PER_REASON = 2;

type Quote = { text: string; userId: string; simulated: boolean };
type ReasonGroup = { key: string; label: string; count: number; simulated: number; quotes: Quote[] };

const interviewHref = (id: string) => `/interview/${encodeURIComponent(id)}`;

/** Single spaces, no period at the end. */
const tidy = (s: string) => s.trim().replace(/\s+/g, " ").replace(/[.!…]+$/u, "");
/** Grouping key: the same reason regardless of capitalization and a trailing period. */
const reasonKey = (s: string) => tidy(s).toLowerCase();

/** Up to `max` quotes: real interviews first, one from each person, no repeats. */
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

/** Same main reason = same item. Sorted by number of people, with "no reason given" last. */
function groupReasons(results: InterviewResult[]): ReasonGroup[] {
  const byKey = new Map<string, InterviewResult[]>();
  for (const r of results) {
    const key = reasonKey(r.mainReason || "") || NO_REASON;
    byKey.set(key, [...(byKey.get(key) ?? []), r]);
  }
  return [...byKey]
    .map(([key, rs]) => {
      // Item text: as a real interview wrote it, if there is one.
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
  let latest = "";
  for (const record of listInterviews()) {
    if (!members.has(record.result.userId)) continue;
    results.set(record.result.userId, record.result);
    if (record.completedAt > latest) latest = record.completedAt;
  }
  const done = [...results.values()];
  // Changes when a new (or repeated) interview arrives, so the synthesis then fetches a new version.
  const resultsVersion = `${done.length}:${latest}`;
  const simulated = done.filter((r) => r.simulated).length;
  const reasons = groupReasons(done);
  // Real Folio people (not samples) first, then the interviewed ones, then by ID.
  const rows = [...segment.userIds].sort((a, b) =>
    Number(isSample(a)) - Number(isSample(b)) ||
    Number(!results.has(a)) - Number(!results.has(b)) ||
    a.localeCompare(b));

  return (
    <main>
      <p className="muted"><Link href="/">← Groups</Link></p>
      <h1>{segment.name} <span className="pill">{personCount(segment.userIds.length)}</span></h1>
      <p className="lede">{segment.researchQuestion}</p>
      <p className="muted">{segment.why}</p>
      <p>
        Interviewed <b>{done.length} of {segment.userIds.length}</b>
        {simulated > 0 && <span className="muted"> (simulated: {simulated})</span>}
      </p>
      <AutoRefresh />
      <Synthesis segmentId={segment.id} version={resultsVersion} interviews={done.length} />
      <div className="split">
        <section className="card table-card">
          <h2>Users</h2>
          {rows.length === 0 ? (
            <p className="muted">There is no one in this group right now.</p>
          ) : (
            <div className="table-wrap">
              <table className="people">
                <thead>
                  <tr><th>Person</th><th>Name</th><th>Role</th><th>Interview</th><th>Main reason</th><th>Tone</th></tr>
                </thead>
                <tbody>
                  {rows.map((userId) => {
                    const person = peopleById.get(userId);
                    const r = results.get(userId);
                    return (
                      <tr key={userId}>
                        <td>
                          <Link href={interviewHref(userId)}>{userId}</Link>
                          {!isSample(userId) && <> <span className="pill live">live</span></>}
                        </td>
                        <td>{person?.name || "—"}</td>
                        <td>{person?.role || "—"}</td>
                        <td className="nowrap">
                          {r ? <>✓{r.simulated && <> <span className="pill sim">simulated</span></>}</> : <span className="muted">—</span>}
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
          <h2>Reasons</h2>
          {reasons.length === 0 ? (
            <p className="muted">No interviews in this group yet. Open a person from the table and start an interview.</p>
          ) : (
            <>
              <p className="muted">Main reasons from the interviews, grouped by code on identical text (no AI).</p>
              <ul className="reasons">
                {reasons.map((g) => (
                  <li key={g.key}>
                    <b>{g.label}</b> <span className="pill">{personCount(g.count)}</span>
                    {g.simulated > 0 && (
                      <> <span className="pill sim">{g.simulated === g.count ? "simulated" : `simulated: ${g.simulated}`}</span></>
                    )}
                    {g.quotes.map((q) => (
                      <blockquote key={`${q.userId}|${q.text}`} className="quote">
                        <span className="qm" aria-hidden="true">“</span>{q.text}” <span className="muted">— <Link href={interviewHref(q.userId)}>{q.userId}</Link></span>
                        {q.simulated && <> <span className="pill sim">simulated</span></>}
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
